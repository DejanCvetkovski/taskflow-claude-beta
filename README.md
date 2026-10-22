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

> Status: contract only. Exact setup, run and test commands are filled in at
> integration, once `apps/api` and `apps/web` exist.

1. Start MongoDB, either a local MongoDB Community install or
   `docker run -p 27017:27017 mongo:7`.
2. Start the API from `apps/api` (commands added at integration).
3. Start the web app from `apps/web` (commands added at integration) and open
   http://localhost:5173.
