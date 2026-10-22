import os
import uuid

import pytest
from fastapi.testclient import TestClient
from pymongo import MongoClient
from pymongo.errors import PyMongoError

from app.config import Settings
from app.main import create_app

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")


@pytest.fixture(scope="session")
def mongo_client():
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
    try:
        client.admin.command("ping")
    except PyMongoError as exc:
        pytest.fail(f"The API tests need a running mongod at {MONGODB_URI}: {exc}")
    yield client
    client.close()


@pytest.fixture
def settings(mongo_client):
    """A throwaway database per test, dropped afterwards."""
    name = f"taskflow_test_{uuid.uuid4().hex[:12]}"
    yield Settings(mongodb_uri=MONGODB_URI, mongodb_db=name)
    mongo_client.drop_database(name)


@pytest.fixture
def make_client(settings):
    """Builds a fresh app instance and client on the test database."""
    opened = []

    def _make(**kwargs) -> TestClient:
        client = TestClient(create_app(settings), **kwargs)
        client.__enter__()
        opened.append(client)
        return client

    yield _make
    for client in opened:
        client.__exit__(None, None, None)


@pytest.fixture
def client(make_client) -> TestClient:
    return make_client()
