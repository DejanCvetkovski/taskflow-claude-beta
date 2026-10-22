import uuid
from datetime import datetime, timezone
from typing import Any

from pymongo import DESCENDING, ReturnDocument
from pymongo.collection import Collection
from pymongo.database import Database

# Newest first; _id breaks ties between TODOs created in the same millisecond.
LIST_ORDER = [("created_at", DESCENDING), ("_id", DESCENDING)]


def _now() -> datetime:
    # BSON dates have millisecond precision; truncate so the value we return
    # from a write matches what a later read returns.
    now = datetime.now(timezone.utc)
    return now.replace(microsecond=now.microsecond // 1000 * 1000)


def _format_datetime(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def to_api(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": doc["_id"],
        "title": doc["title"],
        "completed": doc["completed"],
        "created_at": _format_datetime(doc["created_at"]),
        "updated_at": _format_datetime(doc["updated_at"]),
    }


class TodoStore:
    def __init__(self, db: Database) -> None:
        self._todos: Collection = db["todos"]

    def ensure_indexes(self) -> None:
        self._todos.create_index(LIST_ORDER, name="created_at_desc")

    def list(self) -> list[dict[str, Any]]:
        return [to_api(doc) for doc in self._todos.find().sort(LIST_ORDER)]

    def create(self, title: str) -> dict[str, Any]:
        now = _now()
        doc = {
            "_id": str(uuid.uuid4()),
            "title": title,
            "completed": False,
            "created_at": now,
            "updated_at": now,
        }
        self._todos.insert_one(doc)
        return to_api(doc)

    def update(self, todo_id: str, changes: dict[str, Any]) -> dict[str, Any] | None:
        doc = self._todos.find_one_and_update(
            {"_id": todo_id},
            {"$set": {**changes, "updated_at": _now()}},
            return_document=ReturnDocument.AFTER,
        )
        return to_api(doc) if doc else None

    def delete(self, todo_id: str) -> bool:
        return self._todos.delete_one({"_id": todo_id}).deleted_count == 1
