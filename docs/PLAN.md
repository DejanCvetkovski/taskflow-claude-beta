# TaskFlow MVP plan

Approved by the founder on 2026-10-22. The full plan with rationale lives in the
project's "TaskFlow MVP implementation plan" doc; this file is the in-repo summary
that every thread works from. Requirements: [`TODO_INIT_APP.md`](../TODO_INIT_APP.md).
API contract: [`docs/api/openapi.yaml`](api/openapi.yaml).

## Stack (one deviation from the brief)

- Frontend: React + TypeScript + Vite, native CSS, Fetch API, Vitest + React Testing Library.
- Backend: Python 3.11+, FastAPI, Pydantic, pytest + TestClient.
- **Database: MongoDB 7.0 (founder's decision, replaces the brief's SQLite).**
  Official `pymongo` driver (sync, no ODM), one `todos` collection.

## Roles and file ownership

| Role | Runs in | Writes only | Delivers |
| --- | --- | --- | --- |
| Product + Coordinator | Planning thread | `docs/PLAN.md`, `docs/api/openapi.yaml`, `README.md`, `.gitignore`, integration merges | Contract, briefs, integration, final report |
| Backend | Backend thread | `apps/api/**` | FastAPI + MongoDB API, pytest suite |
| Frontend | Frontend thread | `apps/web/**` | React UI, typed API client, Vitest tests |
| QA | QA thread (fresh context) | `docs/QA_REPORT.md` | Independent verification, issues, evidence |

No thread edits `docs/api/openapi.yaml`. A needed contract change goes to the
coordinator, who brings it to the founder before both sides change.

## Tasks and dependencies

| # | Task | Owner | Depends on | Branch |
| --- | --- | --- | --- | --- |
| A2 | Contract, plan, README, .gitignore | Coordinator | G1 (approved) | `contract` |
| B1 | Backend API, MongoDB store, tests | Backend | A2 | `feat/backend` (from `contract`) |
| B2 | Frontend UI, API client, tests | Frontend | A2 | `feat/frontend` (from `contract`) |
| C1 | Merge both, run every check, README run steps | Coordinator | B1, B2 | `integration/mvp` |
| C2 | Independent QA, E2E in headless Chromium, `QA_REPORT.md` | QA | C1 | `integration/mvp` |
| C3 | Fixes routed to the owning thread (max 2 rounds) | Backend / Frontend | C2 | owning branch |
| C4 | QA re-check of fixed issues | QA | C3 | `integration/mvp` |
| C5 | Final report + PR `integration/mvp` -> `main` | Coordinator | C4 | waits for founder (G3) |

B1 and B2 run in parallel; everything else is sequential. Feature PRs target
`contract` so each shows only its own files. Nothing merges to `main` without the
founder's explicit approval.

## Backend spec (B1)

- Layout: `apps/api/app/` (FastAPI app, `main:app`), `apps/api/tests/`, `apps/api/requirements.txt`.
- Config: `MONGODB_URI` (default `mongodb://localhost:27017`), `MONGODB_DB` (default `taskflow`).
- Document: `{_id: "<uuid string>", title, completed, created_at, updated_at}`,
  dates as BSON UTC datetimes; the API maps `_id` -> `id` and formats dates as
  `YYYY-MM-DDTHH:MM:SSZ`. Index on `created_at` descending. List sorts
  stored `created_at` (ms precision) desc, then `_id` desc.
- Validation exactly as in `openapi.yaml`: strict types, trim then 1-120, empty
  PATCH -> 422 in FastAPI's list shape, bad UUID path -> 422, missing -> 404
  `{"detail": "Todo not found"}`, unexpected errors -> 500 `{"detail": "Internal server error"}`.
- Tests run against a real `mongod` in a throwaway `taskflow_test_*` database
  dropped afterwards. Cover: create, list order, PATCH title, PATCH completed,
  delete, trim, empty/whitespace/121-char title, strict types, empty PATCH, 404,
  invalid UUID, and persistence via a new app instance and client on the same database.
- Cloud sandbox: Docker is unavailable and MongoDB's download site is blocked;
  install `mongod` from conda-forge with micromamba (verified to work for 7.0.34).

## Frontend spec (B2)

- Layout: `apps/web/` Vite React-TS app; API client and types in `apps/web/src/api/`.
- Requests use relative `/api/...`; `vite.config.ts` proxies `/api` to `http://localhost:8000`.
- Behaviour R1-R7 from the brief: loading, empty, error + Retry states; add via
  button or Enter; client-side trim + 1-120 check with helpful message; checkbox
  toggle with strike-through; inline edit with Save / Cancel (Cancel restores);
  inline delete confirm ("Delete? Yes / No"); All / Active / Completed filter;
  active count; created time via `Intl.DateTimeFormat`.
- Non-optimistic updates: change the list only after the server responds.
  Show the first `detail[].msg` from a 422, a generic message otherwise.
- Accessible labels, visible focus, semantic markup, usable at 375 px wide.
- No mock mode or localStorage in the app; mocks live only in tests.
- Scripts: `npm run dev`, `npm run typecheck` (`tsc --noEmit`), `npm test`
  (`vitest run`), `npm run build`. Tests cover at least validation, filtering
  with active count, and one mutation.

## Definition of done

See section 7 of the brief. QA records actual commands and results in
`docs/QA_REPORT.md`; anything not verified is reported as "Not verified".
