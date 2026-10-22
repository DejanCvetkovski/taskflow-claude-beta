# TaskFlow API

FastAPI + MongoDB backend implementing [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml).

## Layout

- `app/main.py`: app factory `create_app()` and the `app` instance (`app.main:app`), routes and the 500 handler
- `app/schemas.py`: Pydantic request/response models, strict types and title trimming
- `app/store.py`: `todos` collection access with the official `pymongo` driver
- `app/config.py`: `MONGODB_URI` (default `mongodb://localhost:27017`), `MONGODB_DB` (default `taskflow`)
- `tests/`: pytest suite against a real `mongod`

## Run

Requires Python 3.11+ and MongoDB 7.0 listening on `MONGODB_URI`.

```sh
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

## Test

The suite needs a running `mongod` (it fails, rather than skips, when none is
reachable). Each test uses its own `taskflow_test_*` database and drops it afterwards.

```sh
cd apps/api
.venv/bin/python -m pytest
```

### MongoDB without Docker

If Docker and MongoDB's own downloads are unavailable, conda-forge has `mongod`:

```sh
micromamba create -y -p ./.mongo -c conda-forge mongodb=7.0
mkdir -p ./.mongo-data
./.mongo/bin/mongod --dbpath ./.mongo-data --bind_ip 127.0.0.1 --port 27017 --fork --logpath ./.mongo-data/mongod.log
```

## Storage

One `todos` collection. Documents are
`{_id: "<uuid4 string>", title, completed, created_at, updated_at}` with dates
as BSON UTC datetimes. The API returns `_id` as `id` and dates as
`YYYY-MM-DDTHH:MM:SSZ`. The compound index `created_at_desc`
(`created_at` -1, `_id` -1) serves the list order: newest first, ties by id descending.
