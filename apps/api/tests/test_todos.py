import re
import uuid

import pytest

TODO_KEYS = {"id", "title", "completed", "created_at", "updated_at"}
TIMESTAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
TITLE_ERROR = "Title must be 1-120 characters after trimming"


def create(client, title="Buy milk"):
    response = client.post("/api/todos", json={"title": title})
    assert response.status_code == 201, response.text
    return response.json()


def assert_validation_error(response, msg=None):
    assert response.status_code == 422, response.text
    detail = response.json()["detail"]
    assert isinstance(detail, list) and detail
    for error in detail:
        assert {"loc", "msg", "type"} <= error.keys()
    if msg is not None:
        assert detail[0]["msg"] == msg
    return detail


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_create_returns_new_todo(client):
    todo = create(client, "Review the API contract")
    assert set(todo) == TODO_KEYS
    assert uuid.UUID(todo["id"]).version == 4
    assert todo["title"] == "Review the API contract"
    assert todo["completed"] is False
    assert TIMESTAMP.match(todo["created_at"])
    assert todo["created_at"] == todo["updated_at"]


def test_create_trims_title(client):
    todo = create(client, "   Buy milk \t\n")
    assert todo["title"] == "Buy milk"
    assert client.get("/api/todos").json()[0]["title"] == "Buy milk"


def test_create_accepts_120_chars_after_trim(client):
    todo = create(client, "  " + "a" * 120 + "  ")
    assert todo["title"] == "a" * 120


@pytest.mark.parametrize("title", ["", "   ", "\t\n", "a" * 121, " " + "a" * 121 + " "])
def test_create_rejects_bad_title_length(client, title):
    response = client.post("/api/todos", json={"title": title})
    detail = assert_validation_error(response, TITLE_ERROR)
    assert detail[0]["loc"] == ["body", "title"]
    assert client.get("/api/todos").json() == []


@pytest.mark.parametrize("title", [None, 1, 1.5, True, ["a"], {"a": 1}])
def test_create_rejects_non_string_title(client, title):
    assert_validation_error(client.post("/api/todos", json={"title": title}))


@pytest.mark.parametrize("body", [{}, {"name": "x"}])
def test_create_requires_title(client, body):
    assert_validation_error(client.post("/api/todos", json=body))


def test_create_ignores_unknown_fields(client):
    response = client.post(
        "/api/todos", json={"title": "x", "completed": True, "id": "abc", "extra": 1}
    )
    assert response.status_code == 201
    todo = response.json()
    assert todo["completed"] is False
    assert todo["id"] != "abc"
    assert set(todo) == TODO_KEYS


@pytest.mark.parametrize(
    "content", [b"{not json", b"", b'["a"]', b'"title"', b"null"]
)
def test_create_rejects_malformed_or_non_object_body(client, content):
    response = client.post(
        "/api/todos", content=content, headers={"Content-Type": "application/json"}
    )
    assert_validation_error(response)


def test_list_is_empty_initially(client):
    response = client.get("/api/todos")
    assert response.status_code == 200
    assert response.json() == []


def test_list_newest_first(client):
    ids = [create(client, f"todo {i}")["id"] for i in range(5)]
    listed = client.get("/api/todos").json()
    assert [t["id"] for t in listed] == list(reversed(ids))
    assert all(set(t) == TODO_KEYS for t in listed)


def test_list_breaks_created_at_ties_by_id_desc(client, settings, mongo_client):
    from datetime import datetime, timezone

    same = datetime(2026, 10, 21, 12, 0, 0, tzinfo=timezone.utc)
    ids = [str(uuid.uuid4()) for _ in range(4)]
    mongo_client[settings.mongodb_db]["todos"].insert_many(
        [
            {"_id": i, "title": i, "completed": False, "created_at": same, "updated_at": same}
            for i in ids
        ]
    )
    listed = client.get("/api/todos").json()
    assert [t["id"] for t in listed] == sorted(ids, reverse=True)
    assert listed[0]["created_at"] == "2026-10-21T12:00:00Z"


def test_patch_title(client):
    todo = create(client, "Old")
    response = client.patch(f"/api/todos/{todo['id']}", json={"title": "  New  "})
    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "New"
    assert updated["completed"] is False
    assert updated["id"] == todo["id"]
    assert updated["created_at"] == todo["created_at"]
    assert TIMESTAMP.match(updated["updated_at"])
    assert updated["updated_at"] >= todo["updated_at"]
    assert client.get("/api/todos").json()[0]["title"] == "New"


def test_patch_completed_toggles(client):
    todo = create(client)
    done = client.patch(f"/api/todos/{todo['id']}", json={"completed": True})
    assert done.status_code == 200
    assert done.json()["completed"] is True
    assert done.json()["title"] == todo["title"]
    undone = client.patch(f"/api/todos/{todo['id']}", json={"completed": False})
    assert undone.json()["completed"] is False
    assert client.get("/api/todos").json()[0]["completed"] is False


def test_patch_both_fields(client):
    todo = create(client)
    response = client.patch(
        f"/api/todos/{todo['id']}", json={"title": "Both", "completed": True}
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Both"
    assert response.json()["completed"] is True


def test_patch_refreshes_updated_at(client, settings, mongo_client):
    from datetime import datetime, timezone

    todo = create(client)
    old = datetime(2020, 1, 1, tzinfo=timezone.utc)
    mongo_client[settings.mongodb_db]["todos"].update_one(
        {"_id": todo["id"]}, {"$set": {"updated_at": old}}
    )
    updated = client.patch(f"/api/todos/{todo['id']}", json={"completed": True}).json()
    assert updated["updated_at"] != "2020-01-01T00:00:00Z"
    assert updated["updated_at"] >= todo["created_at"]


@pytest.mark.parametrize("body", [{}, {"unknown": 1}])
def test_patch_requires_a_field(client, body):
    todo = create(client)
    response = client.patch(f"/api/todos/{todo['id']}", json=body)
    assert_validation_error(response, "At least one of title or completed is required")


@pytest.mark.parametrize(
    "body",
    [
        {"title": None},
        {"title": 5},
        {"completed": None},
        {"completed": "true"},
        {"completed": 1},
        {"completed": 0},
        {"title": "ok", "completed": "false"},
    ],
)
def test_patch_rejects_wrong_types(client, body):
    todo = create(client)
    assert_validation_error(client.patch(f"/api/todos/{todo['id']}", json=body))
    assert client.get("/api/todos").json()[0] == todo


@pytest.mark.parametrize("title", ["", "  ", "a" * 121])
def test_patch_rejects_bad_title_length(client, title):
    todo = create(client)
    response = client.patch(f"/api/todos/{todo['id']}", json={"title": title})
    assert_validation_error(response, TITLE_ERROR)
    assert client.get("/api/todos").json()[0] == todo


def test_patch_rejects_malformed_json(client):
    todo = create(client)
    response = client.patch(
        f"/api/todos/{todo['id']}",
        content=b"{oops",
        headers={"Content-Type": "application/json"},
    )
    assert_validation_error(response)


def test_patch_missing_todo_is_404(client):
    response = client.patch(f"/api/todos/{uuid.uuid4()}", json={"completed": True})
    assert response.status_code == 404
    assert response.json() == {"detail": "Todo not found"}


def test_delete(client):
    keep = create(client, "keep")
    gone = create(client, "gone")
    response = client.delete(f"/api/todos/{gone['id']}")
    assert response.status_code == 204
    assert response.content == b""
    assert [t["id"] for t in client.get("/api/todos").json()] == [keep["id"]]
    again = client.delete(f"/api/todos/{gone['id']}")
    assert again.status_code == 404
    assert again.json() == {"detail": "Todo not found"}


def test_delete_missing_todo_is_404(client):
    response = client.delete(f"/api/todos/{uuid.uuid4()}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Todo not found"}


@pytest.mark.parametrize("bad_id", ["not-a-uuid", "123", "550e8400-e29b-41d4-a716-44665544000z"])
@pytest.mark.parametrize("method", ["patch", "delete"])
def test_invalid_uuid_is_422(client, method, bad_id):
    kwargs = {"json": {"completed": True}} if method == "patch" else {}
    response = getattr(client, method)(f"/api/todos/{bad_id}", **kwargs)
    detail = assert_validation_error(response)
    assert detail[0]["loc"] == ["path", "id"]


def test_data_persists_across_app_instances(make_client):
    first = make_client()
    todo = create(first, "Survives restart")
    first.patch(f"/api/todos/{todo['id']}", json={"completed": True})
    first.__exit__(None, None, None)

    second = make_client()
    listed = second.get("/api/todos").json()
    assert len(listed) == 1
    assert listed[0]["id"] == todo["id"]
    assert listed[0]["title"] == "Survives restart"
    assert listed[0]["completed"] is True
    assert listed[0]["created_at"] == todo["created_at"]


def test_unexpected_error_is_generic_500(make_client, monkeypatch):
    from app.store import TodoStore

    def boom(self):
        raise RuntimeError("secret internals")

    monkeypatch.setattr(TodoStore, "list", boom)
    client = make_client(raise_server_exceptions=False)
    response = client.get("/api/todos")
    assert response.status_code == 500
    assert response.json() == {"detail": "Internal server error"}
    assert "secret" not in response.text


def test_created_at_index_exists(client, settings, mongo_client):
    indexes = mongo_client[settings.mongodb_db]["todos"].index_information()
    assert indexes["created_at_desc"]["key"] == [("created_at", -1), ("_id", -1)]
