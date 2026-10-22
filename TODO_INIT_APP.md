# TODO_INIT_APP.md

**Project:** TaskFlow — Full-Stack TODO App  
**Document type:** Product brief + engineering specification + multi-agent coordination test  
**Version:** 1.0  
**Purpose:** Test Claude Code Projects (Beta) as an AI product-development coordinator.

---

## 1. Mission

Build a small but genuinely working full-stack TODO application. The primary goal is **not** to maximize features: it is to verify that Claude Projects can plan work, coordinate frontend and backend implementation, share a stable API contract, validate results, and present reviewable changes.

The finished app must allow a user to create, view, edit, complete/uncomplete, filter, and delete TODOs. Data must persist after the browser is refreshed and after the API is restarted.

Keep the implementation approachable and production-minded without adding unnecessary infrastructure.

## 2. Requested AI team and responsibilities

The **Project Coordinator** owns the overall plan, task dependencies, integration, status reporting, and final handoff. Delegate specialized work to separate threads when it provides real value; do not start many threads just to simulate a team.

| Role | Responsibility | Expected output |
|---|---|---|
| Product Agent | Clarify scope, user stories, acceptance criteria, and UX states | Concise implementation plan and acceptance checklist |
| Backend Agent | Define contract, implement REST endpoints and SQLite persistence | Backend changes and passing backend tests |
| Frontend Agent | Build responsive React UI against the agreed contract | Frontend changes and passing frontend checks |
| QA Agent | Verify API behavior, integration, UI states and regressions | Test results, issues found, final verification report |

The Product and QA roles may be implemented by focused threads or delegated review tasks. For the main test, use **two parallel implementation threads** after a common contract has been approved: one frontend and one backend.

### Coordination requirements

1. **Plan before coding.** First propose the implementation plan, API contract, delegation, and acceptance criteria. Ask for founder approval before implementing.
2. **Contract first.** Create `docs/api/openapi.yaml` (or an equivalent clearly documented OpenAPI contract) before independent FE/BE implementation. Treat the approved contract as the source of truth.
3. **Parallel, isolated work.** Frontend and backend implementation should run on distinct branches/threads, ideally with non-overlapping file ownership.
4. **No invented integration assumptions.** Frontend consumes the approved API shape. If the contract needs to change, bring the change to the coordinator before editing both sides.
5. **Integration is explicit.** After both implementations, verify the combined application, not only isolated components.
6. **QA is independent.** Request verification from a different thread/context where possible; do not simply accept the implementation agents' self-reports.
7. **Founder approval.** Do not merge into the default branch, deploy, use paid external services, or make destructive repository changes without explicit approval.
8. **Report reality.** State which commands actually ran and their results. Never claim tests passed without executing them.

## 3. Technology stack

### Frontend
- React + TypeScript + Vite
- Functional components and React hooks
- Native CSS or CSS Modules (no requirement for a UI component library)
- Fetch API for backend requests; small typed API client
- Vitest + React Testing Library for key component behavior

### Backend
- Python + FastAPI
- SQLite database stored locally for persistence
- Pydantic request/response validation
- Pytest + FastAPI TestClient for endpoint testing
- Keep the database layer simple; a heavy architecture is not necessary for this exercise

### Local development
- Frontend development server on `http://localhost:5173`
- Backend on `http://localhost:8000`
- Use a Vite `/api` proxy to the backend (or clearly documented equivalent)
- No external database, paid API, authentication service, or cloud deployment required
- Use npm for frontend dependencies and a Python virtual environment for backend dependencies

If the repository already contains a reasonable working stack, inspect it first and propose any deviation instead of silently replacing it.

## 4. Repository layout (suggested)

```text
/
├── apps/
│   ├── web/                  # React/Vite frontend
│   └── api/                  # FastAPI backend
├── docs/
│   ├── api/
│   │   └── openapi.yaml      # Shared, agreed API contract
│   ├── PLAN.md               # Work breakdown, dependencies, owners
│   └── QA_REPORT.md          # Test and integration evidence
├── TODO_INIT_APP.md          # This specification
├── README.md                 # Setup, run and test commands
└── .gitignore
```

Avoid introducing a monorepo tool, Docker, Kubernetes, microservices, authentication, or a deployment pipeline for this first test.

## 5. MVP functional requirements

### R1 — View TODOs
- Show stored TODOs on initial load.
- Display title, completion state, and creation time (subtle formatting is enough).
- Order newest created TODOs first.
- Provide a clear empty state when no TODOs exist.
- Provide loading and API error states; show a retry option on failed initial load.

### R2 — Create TODO
- Text input and `Add` button; Enter should submit too.
- Trim whitespace; title must have 1–120 characters after trimming.
- Reject empty or whitespace-only titles and display helpful feedback.
- Newly created TODO appears without a full page reload.

### R3 — Toggle completion
- Checkbox marks a TODO completed or active.
- Completed TODOs are visually distinct (e.g., strike-through).
- Completion state persists in SQLite.

### R4 — Edit title
- Allow editing an existing TODO title.
- Same trimming and validation rules as creation.
- Support Save and Cancel; avoid losing the original title on Cancel.

### R5 — Delete TODO
- Allow deleting a TODO.
- A lightweight confirmation is acceptable, especially to avoid accidental deletion.
- Deleted TODO disappears and remains removed after refresh.

### R6 — Filter and counts
- Filter between **All**, **Active**, and **Completed** (client-side is sufficient).
- Show at least the number of active TODOs.
- Keep filters consistent after create/update/delete.

### R7 — Responsive and accessible UI
- Clean, professional design usable on mobile and desktop.
- Accessible labels for inputs/buttons/checkboxes, visible keyboard focus, semantic markup.
- Keyboard-accessible actions and meaningful error text.
- No complex drag-and-drop, due dates, priorities, projects, or accounts in MVP.

## 6. API contract requirements

Base path: `/api`. All payloads use JSON and `snake_case` properties. Use UUID strings as IDs and ISO 8601 UTC timestamps for dates.

### TODO entity

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Review the API contract",
  "completed": false,
  "created_at": "2026-10-21T12:00:00Z",
  "updated_at": "2026-10-21T12:00:00Z"
}
```

### Endpoints

| Method | Endpoint | Request | Success |
|---|---|---|---|
| GET | `/api/health` | — | `200` with `{ "status": "ok" }` |
| GET | `/api/todos` | — | `200` with a JSON array of TODO objects, newest first |
| POST | `/api/todos` | `{ "title": "..." }` | `201` with created TODO |
| PATCH | `/api/todos/{id}` | `{ "title"?: "...", "completed"?: boolean }` | `200` with updated TODO |
| DELETE | `/api/todos/{id}` | — | `204` with no response body |

### Error behavior
- Return `422` for invalid fields or malformed request data; validate title after trimming.
- Return `404` for nonexistent TODO IDs.
- For PATCH, reject requests with no recognized fields (422).
- Do not expose stack traces in ordinary API responses.
- Use FastAPI's documented validation format or another consistent schema described in OpenAPI.

The frontend must not use fake persistence or localStorage as a substitute for the API and SQLite. Temporary mock data is acceptable during isolated frontend development **only if removed from the final integrated app**.

## 7. Definition of done

A feature is complete only when:

- [ ] All MVP behaviors R1–R7 work against the real backend.
- [ ] TODOs persist across browser refresh and API restart.
- [ ] The frontend uses the agreed API endpoints and response types.
- [ ] API validation and missing-item responses are handled sensibly.
- [ ] UI is usable on a narrow mobile viewport and desktop.
- [ ] Backend tests pass (create, list, update, delete, validation, 404, persistence).
- [ ] Frontend tests pass for at least validation, filtering, and one mutation interaction.
- [ ] Frontend TypeScript check and production build pass.
- [ ] Both local servers can be started using README instructions.
- [ ] The QA report records actual commands, outcomes, and any remaining issues.
- [ ] Work is delivered through reviewable branch(es) / pull request(s), not an unreviewed direct merge.

If cloud limitations prevent a browser-based end-to-end run, report the limitation and still run every feasible build, API, and test command. Do not claim a visual or E2E check that was not performed.

## 8. Proposed execution sequence

### Phase A — Planning and contract (approval required)
1. Inspect the connected repository and project context.
2. Produce `docs/PLAN.md` with concrete tasks, dependencies, ownership and commands.
3. Define the initial OpenAPI contract and data model.
4. Present the plan and contract to the founder for review. **Do not start implementation before approval.**

### Phase B — Parallel implementation
5. Backend thread: implement FastAPI routes, validation, SQLite persistence, and backend tests.
6. Frontend thread: implement responsive React UI and typed API client against the same approved contract; add frontend tests.
7. Each thread works in its own branch and reports files changed, tests run, and blockers.

### Phase C — Integration and QA
8. Integrate the backend and frontend changes in a reviewable integration branch/PR without merging to the default branch.
9. Run frontend build and tests plus backend tests and API smoke tests.
10. QA thread checks acceptance criteria, error states, and any mismatches against the OpenAPI contract.
11. Coordinator returns a final summary with links to branches/PRs, the test matrix, known limitations, and exact local run instructions.

**Cost discipline:** Use no more than two parallel implementation threads initially. Do not spawn extra threads or repeatedly retry expensive tasks without a clear reason.

## 9. Final coordinator report format

At the end, provide:

1. **Status:** Complete / Partially complete / Blocked.
2. **Team activity:** Which tasks were delegated to which threads and what each produced.
3. **Pull requests / branches:** Links or identifiers and merge order, if applicable.
4. **Acceptance checklist:** R1–R7 with Pass / Fail / Not verified.
5. **Verification evidence:** Exact commands executed and results.
6. **How to run:** Copy-paste-ready frontend and backend commands.
7. **Known issues and recommended next step.**

## 10. What this pilot should teach us

This is a test of the **workflow** as much as the application. Evaluate:

- Did the coordinator plan correctly before implementation?
- Did it delegate meaningful and non-overlapping work?
- Did frontend and backend honor one contract?
- Did independent QA catch genuine problems?
- Did the project preserve context across threads?
- Was the result easy for the founder to review?
- Was the usage/cost reasonable for such a small feature?

**Non-goals:** Authentication, multi-user support, production hosting, notifications, drag-and-drop sorting, reminders, due dates, labels, analytics, CI/CD, and autonomous deployment.

---

**Founder instruction:** Treat this file as the MVP requirements and coordination test brief. Where a choice is unspecified, prefer the smallest maintainable implementation, document the assumption, and do not expand scope. Ask for approval at the end of Phase A.
