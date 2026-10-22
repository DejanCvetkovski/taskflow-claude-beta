# TaskFlow

A small full-stack TODO app built to test Claude Projects as a multi-agent
development team. Requirements are in [`TODO_INIT_APP.md`](TODO_INIT_APP.md),
the work plan in [`docs/PLAN.md`](docs/PLAN.md) and the API contract in
[`docs/api/openapi.yaml`](docs/api/openapi.yaml).

## Stack

- `apps/web`: React + TypeScript + Vite (port 5173, proxies `/api` to the backend)
- `apps/api`: Python + FastAPI (port 8000)
- MongoDB 7.0 on `mongodb://localhost:27017`

## Running locally

Prerequisites: Python 3.11+, Node 20+ with npm, and MongoDB 7.0.

**1. Start MongoDB** on `localhost:27017`, using any one of these:

```sh
docker run -d --name taskflow-mongo -p 27017:27017 mongo:7
# or a local MongoDB Community install
# or, without Docker or root, conda-forge (see apps/api/README.md)
```

**2. Start the API** (terminal 1):

```sh
cd apps/api
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --port 8000
```

Optional settings: `MONGODB_URI` (default `mongodb://localhost:27017`) and
`MONGODB_DB` (default `taskflow`).

**3. Start the web app** (terminal 2), then open http://localhost:5173:

```sh
cd apps/web
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:8000`, so no CORS setup is needed.

## Testing

```sh
# Backend: needs a running mongod; each test uses a throwaway taskflow_test_* database
cd apps/api && .venv/bin/python -m pytest -q

# Frontend
cd apps/web && npm run typecheck && npm test && npm run build
```
