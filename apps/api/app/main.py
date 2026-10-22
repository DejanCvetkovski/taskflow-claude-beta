import logging
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Path, Request, Response, status
from fastapi.responses import JSONResponse
from pymongo import MongoClient

from .config import Settings
from .schemas import Health, Todo, TodoCreate, TodoUpdate
from .store import TodoStore

logger = logging.getLogger("taskflow.api")

TodoId = Annotated[UUID, Path(alias="id")]


def get_store(request: Request) -> TodoStore:
    return request.app.state.store


Store = Annotated[TodoStore, Depends(get_store)]


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Todo not found")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        client: MongoClient = MongoClient(
            settings.mongodb_uri, tz_aware=True, serverSelectionTimeoutMS=5000
        )
        try:
            app.state.store = TodoStore(client[settings.mongodb_db])
            app.state.store.ensure_indexes()
            yield
        finally:
            client.close()

    app = FastAPI(title="TaskFlow API", version="1.0.0", lifespan=lifespan)

    @app.exception_handler(Exception)
    async def internal_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"},
        )

    @app.get("/api/health", response_model=Health)
    def get_health() -> dict:
        return {"status": "ok"}

    @app.get("/api/todos", response_model=list[Todo])
    def list_todos(store: Store) -> list[dict]:
        return store.list()

    @app.post("/api/todos", response_model=Todo, status_code=status.HTTP_201_CREATED)
    def create_todo(body: TodoCreate, store: Store) -> dict:
        return store.create(body.title)

    @app.patch("/api/todos/{id}", response_model=Todo)
    def update_todo(todo_id: TodoId, body: TodoUpdate, store: Store) -> dict:
        todo = store.update(str(todo_id), body.changes())
        if todo is None:
            raise _not_found()
        return todo

    @app.delete("/api/todos/{id}", status_code=status.HTTP_204_NO_CONTENT)
    def delete_todo(todo_id: TodoId, store: Store) -> Response:
        if not store.delete(str(todo_id)):
            raise _not_found()
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    return app


app = create_app()
