# TaskFlow QA report

Independent QA of `integration/mvp` at commit `f2777f3` (draft PR #4 into `main`), run on 2026-10-22 in a cloud Linux container. Checked against `TODO_INIT_APP.md` (R1–R7, section 7) and `docs/api/openapi.yaml`. The QA thread did not read the implementation threads' reports and changed no app code.

## Summary

| Area | Result |
| --- | --- |
| Backend pytest against a real `mongod` 7.0.34 | **55 passed** |
| Frontend `npm run typecheck` / `npm test` / `npm run build` | **Pass / 21 passed / Pass** |
| Live contract checks (53 requests against uvicorn) | **52 pass, 1 observation** (issue 5) |
| Browser E2E, headless Chromium, main flow | **53 pass, 5 fail** (issues 1 and 2) |
| API down, Retry, persistence across API / mongod / full restart | **8 pass, 0 fail** |

All seven requirements work against the real backend. No blocker was found. Two issues are worth fixing before merge: keyboard focus is lost after every mutation (issue 1, apps/web) and the client counts title length in UTF-16 units instead of characters (issue 2, apps/web).

## Requirements

| Req | Verdict | Evidence |
| --- | --- | --- |
| R1 View | **Pass** | Loading text while `GET /api/todos` was held open; empty state; newest first; title, checkbox and `<time datetime="…Z">` creation time; error + Retry with API stopped and with mongod stopped; Retry recovers. |
| R2 Create | **Pass**, issue 2 | Add button and Enter both create; title trimmed; input cleared; empty, whitespace and 121-char titles rejected client-side with no request sent; a server 422 `msg` is shown verbatim. |
| R3 Toggle | **Pass** | Checkbox and Space toggle; strike-through via `text-decoration: line-through`; state read back from the API and after restarts. |
| R4 Edit | **Pass** | Save trims and persists; Cancel and Escape keep the original; whitespace, 121-char and server-rejected titles show messages. |
| R5 Delete | **Pass** | Inline Delete? Yes / No; No keeps; Yes removes; gone after reload. |
| R6 Filter and counts | **Pass** | All / Active / Completed with `aria-pressed`; "N tasks left" updates on create, toggle and delete; items leave a filter when toggled out of it; filter-specific empty text. |
| R7 Responsive, accessible | **Pass**, issues 1 and 4 | Every input and button has an accessible name; `main`, one `h1`, `lang="en"`; 3 px focus outline on every tabbed control; no horizontal scroll at 375 px; all actions work by keyboard alone. |

## Definition of done (section 7)

| Item | Verdict |
| --- | --- |
| R1–R7 work against the real backend | Pass (issues below) |
| Persist across browser refresh and API restart | Pass (also across mongod restart and both restarted) |
| Frontend uses the agreed endpoints and types | Pass (`apps/web/src/api/types.ts` mirrors the schemas; only `/api/todos` and `/api/todos/{id}` are called) |
| Validation and missing-item responses handled | Pass |
| Usable at 375 px and desktop | Pass, issue 4 |
| Backend tests pass (create, list, update, delete, validation, 404, persistence) | Pass, 55 tests |
| Frontend tests for validation, filtering and a mutation | Pass, 21 tests |
| Typecheck and production build | Pass |
| Servers start from README | Pass, using the conda-forge mongod route in `apps/api/README.md` |
| QA report with commands and outcomes | This file |
| Delivered through reviewable PRs | Pass (draft PR #4, not merged) |

Deviation noted, not counted as a failure: the brief specifies SQLite; `docs/PLAN.md` records the founder's decision to use MongoDB 7.0, so R3's "persists in SQLite" was verified as "persists in MongoDB".

## Issues found

| # | Severity | Owner | Issue |
| --- | --- | --- | --- |
| 1 | Medium | apps/web | Keyboard focus falls to `<body>` after create, toggle, save and delete |
| 2 | Low | apps/web | Client title length counts UTF-16 units, contract and server count characters |
| 3 | Low | apps/web | With the API stopped the UI says "Something went wrong" instead of "Could not reach the server" |
| 4 | Low | apps/web | At 375 px the title column is about 95 px wide and the edit field about 130 px |
| 5 | Low | contract (coordinator) | Visible `created_at` ties are not ordered by `id` desc as the contract says |
| 6 | Info | apps/api | API exits at startup when mongod is unreachable; at runtime requests wait 5 s then 500 |
| 7 | Info | apps/web | Pressing Enter twice on Delete deletes, because the same button becomes Yes |

### 1. Keyboard focus is lost after every mutation (Medium, apps/web)

Reproduce: Tab to the New task input, type a title, press Enter. Focus moves to `<body>`, so typing a second title does nothing until the user Tabs back. Same after Space on a checkbox (a second Space does nothing), after Enter on Save in edit mode, and after Yes on delete.

Cause: `AddTodoForm` and `TodoItem` set `disabled={busy}` on the focused input/checkbox during the request, and a disabled element loses focus; Save and Yes unmount the focused element. E2E lines: `KB focus stays in New task input after create`, `KB focus kept on a control in the row after Save`, `KB focus stays on checkbox after toggle`, `KB focus not lost to <body> after delete` (all FAIL). Suggested fix: use `readOnly`/`aria-disabled` instead of `disabled` while busy, and move focus to the row's Edit button after Save and to the next row (or the input) after delete.

### 2. Client counts title length in UTF-16 units (Low, apps/web)

Reproduce: paste 100 copies of 😀 into New task and press Enter. The UI says "Title must be 120 characters or fewer (currently 170)." and sends nothing. The server accepts the same title (`POST 120 emoji (120 code points) -> 201`). The `maxLength={TITLE_MAX + 50}` attribute also silently truncated the 200-unit paste to 170 units, which can split an emoji. Suggested fix: count with `[...title].length` in `validateTitle` and drop or raise `maxLength`.

### 3. API-down message is generic (Low, apps/web)

Reproduce: stop uvicorn, keep Vite running, load the app. The Vite proxy answers `500` with an empty body, so the client shows "Could not load tasks. Something went wrong. Please try again." The "Could not reach the server" branch in `client.ts` only runs when `fetch` itself rejects, which never happens behind the dev proxy. The state and Retry work; only the wording is less helpful. Optional fix: treat a 5xx with a non-JSON body as unreachable.

### 4. Narrow layout at 375 px (Low, apps/web)

See `docs/qa/375-list.png` and `docs/qa/375-edit.png`. Edit/Delete stay on the title's row, so titles wrap at about 95 px and the edit field is about 130 px wide (the text scrolls inside it). Usable, but the `@media (max-width: 480px)` rule giving `.todo-actions` a 30 px left margin suggests the actions were meant to drop below the title; adding `flex-basis: 100%` there would do it. Checkboxes are 20×20 px, under the 24 px target-size guideline but with enough spacing.

### 5. Visible tie order (Low, contract)

`GET /api/todos` sorts by the millisecond `created_at` stored in MongoDB, then `_id` desc, but returns `created_at` at second precision. Four TODOs created in the same second came back in creation order (correct, newest first) but not in `id`-descending order, which is what a client reading the contract would expect for equal `created_at` values. The behaviour is better than the contract's literal wording; suggest the contract say "newest first by creation time; ties by id descending" without implying the second-precision values. No code change needed.

### 6. Database outage behaviour (Info, apps/api)

With mongod stopped, `uvicorn app.main:app` exits with code 3 (`ServerSelectionTimeoutError` from `ensure_indexes` in the lifespan). With the API already running, each request waits about 5 s (`serverSelectionTimeoutMS=5000`) and then returns `500 {"detail":"Internal server error"}` with no stack trace in the body; the API recovers without a restart once mongod is back. Reasonable; worth one line in the README.

### 7. Double Enter on Delete deletes (Info, apps/web)

After Enter on Delete, React reuses the focused `<button>` for "Yes", so focus lands on Yes (good for keyboard users) and a second Enter deletes. That is a reasonable trade-off for a lightweight confirmation; noted only so it is a conscious choice.

Also observed and fine: toggling a TODO deleted in another tab shows "This task no longer exists." on the row, and the row stays until reload. Python's `strip()` treats U+0085 as whitespace and JS `trim()` does not, so such a title passes client validation and the server's 422 message is shown; the E2E run uses this to exercise the server-message path.

## Contract conformance

Every path, method and status in `docs/api/openapi.yaml` was exercised against the running server. All 2xx bodies matched the `Todo` / `Health` schemas exactly (no extra keys, UUID v4 ids, `YYYY-MM-DDTHH:MM:SSZ` timestamps). All 422s matched the `ValidationError` list shape (`loc`, `msg`, `type`; FastAPI also adds `input`, which the schema allows). 404s were exactly `{"detail":"Todo not found"}`. No response contained a stack trace. The 500 shape was checked with mongod stopped.

| Endpoint | Statuses verified |
| --- | --- |
| `GET /api/health` | 200 |
| `GET /api/todos` | 200, 500 (mongod down) |
| `POST /api/todos` | 201; 422 for empty, whitespace, 121 chars, null, number, bool, missing, only-unknown, malformed JSON, array, string, empty body |
| `PATCH /api/todos/{id}` | 200 for title, completed, both, upper-case UUID; 404; 422 for `{}`, only-unknown, null title, null completed, `"true"`, `1`, number title, empty, whitespace, 121 chars, malformed, array, empty body, non-UUID id |
| `DELETE /api/todos/{id}` | 204 with empty body; 404 (missing and second delete); 422 non-UUID id |

Undocumented but sensible: `PUT /api/todos/{id}` → 405, unknown path → 404 `{"detail":"Not Found"}`, `Content-Type: text/plain` → 422.

## Commands and results

Environment: Python 3.13.16, Node 22.22.0, MongoDB 7.0.34 (conda-forge via micromamba 2.9.0), Playwright 1.56.1 with the preinstalled Chromium. Docker was not used.

```sh
# MongoDB (micro.mamba.pm is blocked; the GitHub release binary of micromamba works)
curl -sSL -o micromamba https://github.com/mamba-org/micromamba-releases/releases/latest/download/micromamba-linux-64
./micromamba create -y -p ./mongo -c conda-forge mongodb=7.0
./mongo/bin/mongod --dbpath ./data --bind_ip 127.0.0.1 --port 27017 --fork --logpath ./data/mongod.log
#   -> child process started successfully

# Backend
cd apps/api && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # -> ok
.venv/bin/python -m pytest -q
#   -> 55 passed in 1.84s

# Frontend
cd apps/web && npm ci                # -> ok
npm run typecheck                    # -> exit 0
npm test                             # -> 3 files, 21 tests passed
npm run build                        # -> exit 0, dist/assets/index-*.js 149.26 kB (48.27 kB gzip)

# Servers, per README
cd apps/api && .venv/bin/uvicorn app.main:app --port 8000
cd apps/web && npm run dev -- --strictPort
curl -i localhost:8000/api/health    # -> 200 {"status":"ok"}
curl -i localhost:5173/api/todos     # -> 200 [] (through the Vite proxy)

# Live contract checks (script below)
python3 -I contract.py               # -> 52/53, the one FAIL is issue 5

# Browser E2E (script below; Playwright from the global install, not added to the app)
NODE_PATH=/opt/node22/lib/node_modules node e2e.js main docs/qa          # -> 53 passed, 5 failed
#   stop uvicorn
node e2e.js apidown docs/qa                 # -> 4 passed (error, Retry while down, restarts API, Retry recovers)
node e2e.js verify:api-restart docs/qa      # -> 1 passed
mongod --dbpath ./data --shutdown
curl localhost:8000/api/todos               # -> 500 {"detail":"Internal server error"} after 5.02 s
node e2e.js mongodown docs/qa               # -> 1 passed (error state after ~6 s)
#   start mongod again, API left running
node e2e.js verify:mongod-restart docs/qa   # -> 1 passed
#   stop API and mongod; start API alone -> exits with code 3 (issue 6); start mongod, then API
node e2e.js verify:full-restart docs/qa     # -> 1 passed
```

Each `verify:*` run loads the page, reloads it, and compares titles, order and checkbox states with the list saved at the end of the main run (5 TODOs, 2 completed).

### E2E output (main run)

```text
PASS R1 loading state shown while GET /api/todos is pending
PASS R1 empty state shown with no TODOs
PASS R6 count with no TODOs is "0 tasks left"
PASS R2 empty title shows client message
PASS R2 input marked aria-invalid and described by error
PASS R2 whitespace-only rejected on Enter
PASS R2 121 chars rejected client-side
PASS R2 no POST sent for client-invalid titles
PASS R2 server 422 msg displayed
PASS R2 Add button creates trimmed TODO without reload
PASS R2 input cleared after create
PASS R1 newest first in UI
PASS R6 count "3 tasks left"
PASS R1 creation time rendered with machine-readable datetime
INFO created time text: "Oct 22, 2026, 2:17 PM"
FAIL R2 100-emoji title (100 characters, valid per contract) accepted by UI  [Title must be 120 characters or fewer (currently 170).]
PASS R3 completed TODO has strike-through
PASS R6 count drops to "2 tasks left"
PASS R3 completion persisted in the API
PASS R6 Active filter
PASS R6 Active filter button aria-pressed
PASS R6 Completed filter
PASS R3/R6 uncomplete in Completed filter removes it from view and shows filter empty state
PASS R6 count back to "3 tasks left"
PASS R6 create while Active filter shows the new TODO
PASS R6 completing in Active filter hides it
PASS R6 All filter shows 4
PASS R4 edit field autofocused
PASS R4 Cancel restores original title
PASS R4 Escape cancels edit
PASS R4 whitespace edit rejected with message
PASS R4 121-char edit rejected
PASS R4 server 422 message shown on edit
PASS R4 Save stores trimmed title
PASS R4 edit persisted in the API
PASS R4 edit keeps list position (sorted by created_at)
PASS R5 No keeps the TODO
PASS R5 Yes removes TODO
PASS R5 delete persisted in the API
INFO toggle on a TODO deleted elsewhere shows: "This task no longer exists." and the row stays in the list until reload
PASS API 404 surfaced in UI with meaningful text
PASS R5 after reload, list matches server
PASS KB first Tab lands on New task input
PASS KB focus indicator visible on input
PASS KB create via Enter
INFO focus after keyboard create: {"tag":"BODY","label":"TaskFlowNew taskAdd2 tasks leftAllActive","outline":"none 0px"}
FAIL KB focus stays in New task input after create (can add another without re-Tabbing)  [{"tag":"BODY","label":"TaskFlowNew taskAdd2 tasks leftAllActive","outline":"none 0px"}]
INFO tab order after input: BUTTON:Add | BUTTON:All | BUTTON:Active | BUTTON:Completed | INPUT:Mark “Keyboard task” as completed | BUTTON:Edit “Keyboard task” | BUTTON:Delete “Keyboard task”
PASS KB visible focus outline on every tabbed control
PASS KB reached Edit “Keyboard task”
PASS KB Enter on Edit opens editor with focus in field
PASS KB edit saved with Enter
INFO focus after keyboard save: {"tag":"BODY","label":"TaskFlowNew taskAdd2 tasks leftAllActive","outline":"none 0px"}
FAIL KB focus kept on a control in the row after Save (not lost to <body>)  [{"tag":"BODY","label":"TaskFlowNew taskAdd2 tasks leftAllActive","outline":"none 0px"}]
PASS KB Space toggles completion
FAIL KB focus stays on checkbox after toggle  [{"tag":"BODY","label":"TaskFlowNew taskAdd1 task leftAllActiveC","outline":"none 0px"}]
INFO focus after pressing Delete (confirm shown): {"tag":"BUTTON","label":"Yes, delete “Keyboard task edited”","outline":"solid 3px"}
PASS KB focus moves into the delete confirmation (not lost to <body>)
PASS KB delete via Enter on Yes
INFO focus after keyboard delete: {"tag":"BODY","label":"TaskFlowNew taskAdd1 task leftAllActiveC","outline":"none 0px"}
FAIL KB focus not lost to <body> after delete  [{"tag":"BODY","label":"TaskFlowNew taskAdd1 task leftAllActiveC","outline":"none 0px"}]
PASS R7 no horizontal overflow at 375 px
INFO controls under 24px at 375px: [{"l":"Mark “A very long title that keeps going to check wrapping on narrow screens without breaking the layout ok” as completed","h":20,"w":20},{"l":"Mark “Review pull request #4” as active","h":20,"w":20},{"l":"Mark “Prepare sprint demo” as completed","h":20,"w":20},{"l":"Mark “Added while filtered” as active","h":20,"w":20},{"l":"Mark “Buy oat milk” as completed","h":20,"w":20}]
INFO a11y: {"lang":"en","title":"TaskFlow","h1":1,"main":1,"unlabeled":0}
PASS R7 every input/button has an accessible name
PASS R7 semantic landmarks (main, h1, html lang)
INFO saved 5 expected todos for persistence checks
INFO browser logged 3 "Failed to load resource" lines for the intentional 422/404 responses
PASS No unexpected browser console errors

main: 53 passed, 5 failed
```

### E2E output (outage and persistence runs)

```text
INFO error text with API stopped: "Could not load tasks. Something went wrong. Please try again.Retry"
PASS R1 error state shown when API is down
PASS R1 Retry button present
PASS R1 Retry while still down returns to error state
PASS R1 Retry (via keyboard) recovers once the API is back

apidown: 4 passed, 0 failed

PASS Persistence (api-restart): UI after reload shows same titles, order and completion

verify:api-restart: 1 passed, 0 failed

INFO with mongod stopped and API up, error appeared after 5985 ms: "Could not load tasks. Something went wrong. Please try again.Retry"
PASS R1 error state when database is down

mongodown: 1 passed, 0 failed

PASS Persistence (mongod-restart): UI after reload shows same titles, order and completion

verify:mongod-restart: 1 passed, 0 failed

PASS Persistence (full-restart): UI after reload shows same titles, order and completion

verify:full-restart: 1 passed, 0 failed
```

### Contract check output

```text
PASS GET /api/health -> 200 {status: ok}
PASS POST valid -> 201 Todo
PASS POST trims title
PASS POST completed false, created_at == updated_at
PASS POST ignores unknown fields (incl. completed)
PASS POST 120 chars -> 201
PASS POST 120 chars + surrounding spaces -> 201
PASS POST empty title -> 422 validation shape
PASS POST whitespace title -> 422 validation shape
PASS POST 121 chars title -> 422 validation shape
PASS POST null title -> 422 validation shape
PASS POST number title -> 422 validation shape
PASS POST bool title -> 422 validation shape
PASS POST missing title -> 422 validation shape
PASS POST only unknown title -> 422 validation shape
PASS POST malformed JSON -> 422 validation shape
PASS POST array body -> 422 validation shape
PASS POST string body -> 422 validation shape
PASS POST empty body -> 422 validation shape
PASS GET /api/todos -> 200 array of Todo
PASS GET /api/todos newest first
FAIL GET /api/todos sorted created_at desc then id desc  [[('2026-10-22T14:14:20Z', 'bb8f17a8-13ed-4b6a-9e7c-d79f7f330410'), ('2026-10-22T14:14:20Z', 'b684f0ae-d0ef-4f9b-af6e-bea332959fc8'), ('2026-10-22T14:14:20Z', 'f586329a-c115-4160-aac5-e7767fc006ea'), ('2026-10-22T14:14:20Z', '394250b1-32c6-4112-b3f2-cedf3b3f12e2')]]
PASS PATCH completed -> 200 Todo
PASS PATCH title trims -> 200
PASS PATCH both fields -> 200
PASS PATCH keeps created_at
PASS PATCH with upper-case UUID resolves same todo
PASS PATCH {} -> 422 validation shape
PASS PATCH only unknown -> 422 validation shape
PASS PATCH title null -> 422 validation shape
PASS PATCH completed null -> 422 validation shape
PASS PATCH completed 'true' -> 422 validation shape
PASS PATCH completed 1 -> 422 validation shape
PASS PATCH title number -> 422 validation shape
PASS PATCH title empty -> 422 validation shape
PASS PATCH title whitespace -> 422 validation shape
PASS PATCH title 121 -> 422 validation shape
PASS PATCH malformed JSON -> 422 validation shape
PASS PATCH array body -> 422 validation shape
PASS PATCH empty body -> 422 validation shape
PASS PATCH missing id -> 404 {detail: Todo not found}
PASS PATCH missing id with empty body -> 422 (body checked first)
PASS DELETE missing id -> 404 {detail: Todo not found}
PASS PATCH non-UUID 'not-a-uuid' -> 422 validation shape
PASS DELETE non-UUID 'not-a-uuid' -> 422 validation shape
PASS PATCH non-UUID '123' -> 422 validation shape
PASS DELETE non-UUID '123' -> 422 validation shape
PASS PATCH non-UUID '550e8400-e29b-41d4-a716-44665544000Z' -> 422 validation shape
PASS DELETE non-UUID '550e8400-e29b-41d4-a716-44665544000Z' -> 422 validation shape
PASS DELETE -> 204 empty body
PASS DELETE twice -> 404
PASS Deleted todo absent from list
PASS POST 120 emoji (120 code points) -> 201
INFO POST title U+0085 (NEL) -> 422 {"detail":[{"type":"value_error","loc":["body","title"],"msg":"Title must be 1-120 characters after trimming","input":""}]}
INFO PUT /api/todos/{id} -> 405 {"detail":"Method Not Allowed"}
INFO GET /api/nope -> 404 {"detail":"Not Found"}
INFO POST with text/plain content-type -> 422 {"detail":[{"type":"model_attributes_type","loc":["body"],"msg":"Input should be a valid dictionary or object to extract fields from","input":"{\"title\":\"x\"}"}]}

52/53 contract checks passed
```

## Screenshots

All in `docs/qa/`.

| File | Shows |
| --- | --- |
| `1280-loading.png` | Loading state |
| `1280-empty.png` | Empty state |
| `1280-client-validation.png` | 121-character client message |
| `1280-server-validation.png` | Server 422 message on create |
| `1280-edit-validation.png` | Server 422 message on edit |
| `1280-delete-confirm.png` | Inline delete confirmation |
| `1280-keyboard-focus.png` | Focus outline on a row control |
| `1280-list.png` | Desktop list with completed items |
| `1280-error-retry.png` | Error + Retry with the API stopped |
| `1280-after-api-restart.png`, `1280-after-mongod-restart.png`, `1280-after-full-restart.png` | List after each restart and reload |
| `375-list.png`, `375-edit.png`, `375-delete-confirm.png`, `375-validation.png`, `375-error-retry.png` | Mobile width |

## Not verified

- Screen-reader output (no assistive technology in the container); only accessible names, roles and landmarks were checked.
- Browsers other than Chromium, and a real touch device.
- Colour contrast and dark mode were not measured.

## QA scripts

Kept out of the app and its dependencies; included here so the run can be repeated.

<details><summary><code>contract.py</code></summary>

```python
"""Live contract checks against http://localhost:8000 (stdlib only)."""
import json, re, sys, uuid, urllib.request, urllib.error

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
TS = re.compile(r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
results = []

def call(method, path, body=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    h = {"Content-Type": "application/json"} if data is not None else {}
    h.update(headers or {})
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        r = urllib.request.urlopen(req)
        status, text, ctype = r.status, r.read().decode(), r.headers.get("content-type")
    except urllib.error.HTTPError as e:
        status, text, ctype = e.code, e.read().decode(), e.headers.get("content-type")
    try:
        parsed = json.loads(text) if text else None
    except ValueError:
        parsed = text
    return status, parsed, text, ctype

def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (f"  [{detail}]" if detail and not cond else ""))

def is_todo(t):
    return (isinstance(t, dict) and set(t) == {"id","title","completed","created_at","updated_at"}
            and str(uuid.UUID(t["id"])) == t["id"] and uuid.UUID(t["id"]).version == 4
            and isinstance(t["title"], str) and 1 <= len(t["title"]) <= 120
            and type(t["completed"]) is bool and TS.match(t["created_at"]) and TS.match(t["updated_at"]))

def is_validation(b):
    return (isinstance(b, dict) and isinstance(b.get("detail"), list) and b["detail"]
            and all(isinstance(d.get("loc"), list) and isinstance(d.get("msg"), str) and isinstance(d.get("type"), str) for d in b["detail"]))

def no_trace(text):
    return "Traceback" not in text and 'File "' not in text

s, b, t, c = call("GET", "/api/health")
check("GET /api/health -> 200 {status: ok}", s == 200 and b == {"status": "ok"} and "json" in c, f"{s} {t}")

s, b, t, c = call("POST", "/api/todos", {"title": "  Contract one  "})
check("POST valid -> 201 Todo", s == 201 and is_todo(b), f"{s} {t}")
check("POST trims title", b.get("title") == "Contract one", t)
check("POST completed false, created_at == updated_at", b.get("completed") is False and b.get("created_at") == b.get("updated_at"), t)
first = b
s, b, t, c = call("POST", "/api/todos", {"title": "Contract two", "extra": 1, "completed": True})
check("POST ignores unknown fields (incl. completed)", s == 201 and is_todo(b) and b["completed"] is False and "extra" not in b, f"{s} {t}")
second = b
s, b, t, c = call("POST", "/api/todos", {"title": "x" * 120})
check("POST 120 chars -> 201", s == 201, f"{s}")
third = b
s, b, t, c = call("POST", "/api/todos", {"title": "  " + "y" * 120 + "  "})
check("POST 120 chars + surrounding spaces -> 201", s == 201 and b["title"] == "y" * 120, f"{s}")
fourth = b

for label, body in [("empty", {"title": ""}), ("whitespace", {"title": "   \t "}), ("121 chars", {"title": "z" * 121}),
                    ("null", {"title": None}), ("number", {"title": 5}), ("bool", {"title": True}),
                    ("missing", {}), ("only unknown", {"name": "x"})]:
    s, b, t, c = call("POST", "/api/todos", body)
    check(f"POST {label} title -> 422 validation shape", s == 422 and is_validation(b) and no_trace(t), f"{s} {t}")
for label, raw in [("malformed JSON", b"{bad"), ("array body", b"[]"), ("string body", b'"x"'), ("empty body", b"")]:
    s, b, t, c = call("POST", "/api/todos", raw=raw)
    check(f"POST {label} -> 422 validation shape", s == 422 and is_validation(b) and no_trace(t), f"{s} {t}")

s, b, t, c = call("GET", "/api/todos")
ids = [x["id"] for x in b]
check("GET /api/todos -> 200 array of Todo", s == 200 and isinstance(b, list) and all(is_todo(x) for x in b), f"{s}")
check("GET /api/todos newest first", ids[:4] == [fourth["id"], third["id"], second["id"], first["id"]], str(ids))
keys = [(x["created_at"], x["id"]) for x in b]
check("GET /api/todos sorted created_at desc then id desc", keys == sorted(keys, reverse=True), str(keys))

tid = first["id"]
s, b, t, c = call("PATCH", f"/api/todos/{tid}", {"completed": True})
check("PATCH completed -> 200 Todo", s == 200 and is_todo(b) and b["completed"] is True, f"{s} {t}")
s, b, t, c = call("PATCH", f"/api/todos/{tid}", {"title": "  Renamed  "})
check("PATCH title trims -> 200", s == 200 and b["title"] == "Renamed" and b["completed"] is True, f"{s} {t}")
s, b, t, c = call("PATCH", f"/api/todos/{tid}", {"title": "Both", "completed": False})
check("PATCH both fields -> 200", s == 200 and b["title"] == "Both" and b["completed"] is False, f"{s} {t}")
check("PATCH keeps created_at", b["created_at"] == first["created_at"], t)
s, b, t, c = call("PATCH", f"/api/todos/{tid.upper()}", {"completed": True})
check("PATCH with upper-case UUID resolves same todo", s == 200 and b["id"] == tid, f"{s} {t}")
for label, body in [("{}", {}), ("only unknown", {"foo": 1}), ("title null", {"title": None}), ("completed null", {"completed": None}),
                    ("completed 'true'", {"completed": "true"}), ("completed 1", {"completed": 1}), ("title number", {"title": 3}),
                    ("title empty", {"title": ""}), ("title whitespace", {"title": "  "}), ("title 121", {"title": "a" * 121})]:
    s, b, t, c = call("PATCH", f"/api/todos/{tid}", body)
    check(f"PATCH {label} -> 422 validation shape", s == 422 and is_validation(b) and no_trace(t), f"{s} {t}")
for label, raw in [("malformed JSON", b"{bad"), ("array body", b"[]"), ("empty body", b"")]:
    s, b, t, c = call("PATCH", f"/api/todos/{tid}", raw=raw)
    check(f"PATCH {label} -> 422 validation shape", s == 422 and is_validation(b), f"{s} {t}")

missing = str(uuid.uuid4())
s, b, t, c = call("PATCH", f"/api/todos/{missing}", {"completed": True})
check("PATCH missing id -> 404 {detail: Todo not found}", s == 404 and b == {"detail": "Todo not found"}, f"{s} {t}")
s, b, t, c = call("PATCH", f"/api/todos/{missing}", {})
check("PATCH missing id with empty body -> 422 (body checked first)", s == 422, f"{s} {t}")
s, b, t, c = call("DELETE", f"/api/todos/{missing}")
check("DELETE missing id -> 404 {detail: Todo not found}", s == 404 and b == {"detail": "Todo not found"}, f"{s} {t}")
for bad in ["not-a-uuid", "123", "550e8400-e29b-41d4-a716-44665544000Z"]:
    for m in ["PATCH", "DELETE"]:
        s, b, t, c = call(m, f"/api/todos/{bad}", {"completed": True} if m == "PATCH" else None)
        check(f"{m} non-UUID '{bad}' -> 422 validation shape", s == 422 and is_validation(b), f"{s} {t}")

s, b, t, c = call("DELETE", f"/api/todos/{second['id']}")
check("DELETE -> 204 empty body", s == 204 and t == "", f"{s} {t!r}")
s, b, t, c = call("DELETE", f"/api/todos/{second['id']}")
check("DELETE twice -> 404", s == 404 and b == {"detail": "Todo not found"}, f"{s} {t}")
s, b, t, c = call("GET", "/api/todos")
check("Deleted todo absent from list", second["id"] not in [x["id"] for x in b])

# Unicode length semantics (contract says 1-120 characters)
s, b, t, c = call("POST", "/api/todos", {"title": "\U0001F600" * 120})
check("POST 120 emoji (120 code points) -> 201", s == 201, f"{s}")
emoji = b if s == 201 else None
s, b, t, c = call("POST", "/api/todos", {"title": "\u0085"})
print(f"INFO POST title U+0085 (NEL) -> {s} {t}")

# Cleanup of rows this script created
for x in [first, third, fourth, emoji]:
    if x: call("DELETE", f"/api/todos/{x['id']}")

# Undocumented statuses
s, b, t, c = call("PUT", f"/api/todos/{missing}", {"title": "x"})
print(f"INFO PUT /api/todos/{{id}} -> {s} {t}")
s, b, t, c = call("GET", "/api/nope")
print(f"INFO GET /api/nope -> {s} {t}")
s, b, t, c = call("POST", "/api/todos", raw=b'{"title":"x"}', headers={"Content-Type": "text/plain"})
print(f"INFO POST with text/plain content-type -> {s} {t[:200]}")

fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} contract checks passed")
sys.exit(1 if fails else 0)
```

</details>

<details><summary><code>e2e.js</code></summary>

```js
// QA E2E driver. Usage: node e2e.js <phase> <shotDir>
const { chromium } = require('playwright');
const fs = require('fs');
const { spawn } = require('child_process');

const APP = 'http://localhost:5173/';
const phase = process.argv[2];
const SHOTS = process.argv[3];
const STATE = __dirname + '/expected.json';
let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) pass++; else fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${!cond && detail ? `  [${detail}]` : ''}`);
}
const info = (m) => console.log('INFO ' + m);

async function titles(page) {
  return page.locator('.todo-list .todo-title').allTextContents();
}
async function activeCount(page) {
  return (await page.locator('.count').textContent()).trim();
}
async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    const cs = getComputedStyle(el);
    return { tag: el.tagName, label: el.getAttribute('aria-label') || el.textContent.trim().slice(0, 40) || el.id,
             outline: `${cs.outlineStyle} ${cs.outlineWidth}` };
  });
}

async function main(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  const apiCalls = [];
  page.on('request', (r) => r.url().includes('/api/') && apiCalls.push(`${r.method()} ${new URL(r.url()).pathname}`));

  // R1 loading state: hold the first list response
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route('**/api/todos', async (route) => {
    if (route.request().method() === 'GET') { await gate; }
    await route.continue();
  });
  await page.goto(APP);
  const loading = page.getByRole('status').filter({ hasText: 'Loading tasks' });
  await loading.waitFor();
  check('R1 loading state shown while GET /api/todos is pending', await loading.isVisible());
  await page.screenshot({ path: `${SHOTS}/1280-loading.png` });
  release();

  // R1 empty state
  const empty = page.getByText('No tasks yet. Add your first one above.');
  await empty.waitFor();
  check('R1 empty state shown with no TODOs', await empty.isVisible());
  await page.unroute('**/api/todos');
  check('R6 count with no TODOs is "0 tasks left"', (await activeCount(page)) === '0 tasks left', await activeCount(page));
  await page.screenshot({ path: `${SHOTS}/1280-empty.png` });

  // R2 client validation
  const input = page.getByLabel('New task');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  let alert = page.locator('#new-todo-error');
  check('R2 empty title shows client message', (await alert.textContent()) === 'Please enter a task title.', await alert.textContent());
  check('R2 input marked aria-invalid and described by error', (await input.getAttribute('aria-invalid')) === 'true' && (await input.getAttribute('aria-describedby')) === 'new-todo-error');
  await input.fill('     ');
  await input.press('Enter');
  check('R2 whitespace-only rejected on Enter', (await alert.textContent()) === 'Please enter a task title.');
  await input.fill('a'.repeat(121));
  await input.press('Enter');
  check('R2 121 chars rejected client-side', /120 characters or fewer \(currently 121\)/.test(await alert.textContent()), await alert.textContent());
  await page.screenshot({ path: `${SHOTS}/1280-client-validation.png` });
  check('R2 no POST sent for client-invalid titles', !apiCalls.includes('POST /api/todos'), apiCalls.join(','));

  // R2 server validation message: U+0085 is whitespace to Python strip() but not to JS trim()
  await input.fill('\u0085');
  await input.press('Enter');
  await page.waitForResponse((r) => r.url().endsWith('/api/todos') && r.request().method() === 'POST');
  await alert.waitFor();
  check('R2 server 422 msg displayed', (await alert.textContent()) === 'Title must be 1-120 characters after trimming', await alert.textContent());
  await page.screenshot({ path: `${SHOTS}/1280-server-validation.png` });

  // R2 create with Add button, with Enter, trimming
  await input.fill('  Buy milk  ');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Buy milk', { exact: true }).waitFor();
  check('R2 Add button creates trimmed TODO without reload', (await titles(page))[0] === 'Buy milk');
  check('R2 input cleared after create', (await input.inputValue()) === '');
  await input.fill('Write report');
  await input.press('Enter');
  await page.getByText('Write report', { exact: true }).waitFor();
  await input.fill('Call plumber');
  await input.press('Enter');
  await page.getByText('Call plumber', { exact: true }).waitFor();
  check('R1 newest first in UI', JSON.stringify(await titles(page)) === JSON.stringify(['Call plumber', 'Write report', 'Buy milk']), JSON.stringify(await titles(page)));
  check('R6 count "3 tasks left"', (await activeCount(page)) === '3 tasks left', await activeCount(page));
  const time = page.locator('.todo-time').first();
  check('R1 creation time rendered with machine-readable datetime', /Z$/.test(await time.getAttribute('datetime')) && (await time.textContent()).length > 0, await time.textContent());
  info(`created time text: "${await time.textContent()}"`);

  // Emoji: 100 code points (server limit is 120 characters)
  await input.fill('\u{1F600}'.repeat(100));
  await input.press('Enter');
  await page.waitForTimeout(300);
  const emojiMsg = (await alert.count()) ? await alert.textContent() : '(no error)';
  check('R2 100-emoji title (100 characters, valid per contract) accepted by UI', emojiMsg === '(no error)', emojiMsg);
  await input.fill('');

  // R3 toggle
  const cb = page.getByRole('checkbox', { name: 'Mark “Write report” as completed' });
  await cb.click();
  await page.getByRole('checkbox', { name: 'Mark “Write report” as active' }).waitFor();
  const done = page.locator('li.todo', { hasText: 'Write report' });
  const deco = await done.locator('.todo-title').evaluate((e) => getComputedStyle(e).textDecorationLine);
  check('R3 completed TODO has strike-through', deco.includes('line-through'), deco);
  check('R6 count drops to "2 tasks left"', (await activeCount(page)) === '2 tasks left', await activeCount(page));
  const srv = await (await page.request.get('http://localhost:8000/api/todos')).json();
  check('R3 completion persisted in the API', srv.find((t) => t.title === 'Write report').completed === true);

  // R6 filters
  const f = (n) => page.getByRole('button', { name: n, exact: true });
  await f('Active').click();
  check('R6 Active filter', JSON.stringify(await titles(page)) === JSON.stringify(['Call plumber', 'Buy milk']), JSON.stringify(await titles(page)));
  check('R6 Active filter button aria-pressed', (await f('Active').getAttribute('aria-pressed')) === 'true');
  await f('Completed').click();
  check('R6 Completed filter', JSON.stringify(await titles(page)) === JSON.stringify(['Write report']), JSON.stringify(await titles(page)));
  // uncomplete while in Completed filter -> disappears
  await page.getByRole('checkbox', { name: 'Mark “Write report” as active' }).click();
  await page.getByText('No completed tasks yet.').waitFor();
  check('R3/R6 uncomplete in Completed filter removes it from view and shows filter empty state', true);
  check('R6 count back to "3 tasks left"', (await activeCount(page)) === '3 tasks left', await activeCount(page));
  await f('Active').click();
  await input.fill('Added while filtered');
  await input.press('Enter');
  await page.getByText('Added while filtered', { exact: true }).waitFor();
  check('R6 create while Active filter shows the new TODO', (await titles(page))[0] === 'Added while filtered');
  await page.getByRole('checkbox', { name: 'Mark “Added while filtered” as completed' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.todo-title')].some((e) => e.textContent === 'Added while filtered'));
  check('R6 completing in Active filter hides it', true);
  await f('All').click();
  check('R6 All filter shows 4', (await titles(page)).length === 4, JSON.stringify(await titles(page)));

  // R4 edit with mouse: Cancel keeps original, Escape cancels, Save trims
  await page.getByRole('button', { name: 'Edit “Buy milk”' }).click();
  const edit = page.getByLabel('Edit title for “Buy milk”');
  check('R4 edit field autofocused', await edit.evaluate((e) => e === document.activeElement));
  await edit.fill('Changed but cancelled');
  await page.getByRole('button', { name: 'Cancel' }).click();
  check('R4 Cancel restores original title', (await titles(page)).includes('Buy milk') && !(await titles(page)).includes('Changed but cancelled'));
  await page.getByRole('button', { name: 'Edit “Buy milk”' }).click();
  await edit.fill('Escaped');
  await edit.press('Escape');
  check('R4 Escape cancels edit', (await titles(page)).includes('Buy milk'));
  await page.getByRole('button', { name: 'Edit “Buy milk”' }).click();
  await edit.fill('   ');
  await page.getByRole('button', { name: 'Save' }).click();
  const editErr = page.locator('li.todo .field-error');
  check('R4 whitespace edit rejected with message', (await editErr.textContent()) === 'Please enter a task title.', await editErr.textContent());
  await edit.fill('b'.repeat(121));
  await edit.press('Enter');
  check('R4 121-char edit rejected', /currently 121/.test(await editErr.textContent()), await editErr.textContent());
  await edit.fill('\u0085');
  await edit.press('Enter');
  await page.waitForResponse((r) => r.request().method() === 'PATCH');
  await page.waitForTimeout(150);
  check('R4 server 422 message shown on edit', (await editErr.textContent()) === 'Title must be 1-120 characters after trimming', await editErr.textContent());
  await page.screenshot({ path: `${SHOTS}/1280-edit-validation.png` });
  await edit.fill('  Buy oat milk ');
  await page.getByRole('button', { name: 'Save' }).click();
  await page.getByText('Buy oat milk', { exact: true }).waitFor();
  check('R4 Save stores trimmed title', (await titles(page)).includes('Buy oat milk'));
  const srv2 = await (await page.request.get('http://localhost:8000/api/todos')).json();
  check('R4 edit persisted in the API', srv2.some((t) => t.title === 'Buy oat milk'));
  check('R4 edit keeps list position (sorted by created_at)', (await titles(page))[3] === 'Buy oat milk', JSON.stringify(await titles(page)));

  // R5 delete with confirm: No keeps, Yes deletes
  await page.getByRole('button', { name: 'Delete “Call plumber”' }).click();
  await page.screenshot({ path: `${SHOTS}/1280-delete-confirm.png` });
  await page.getByRole('button', { name: 'No, keep “Call plumber”' }).click();
  check('R5 No keeps the TODO', (await titles(page)).includes('Call plumber'));
  await page.getByRole('button', { name: 'Delete “Call plumber”' }).click();
  await page.getByRole('button', { name: 'Yes, delete “Call plumber”' }).click();
  await page.waitForFunction(() => ![...document.querySelectorAll('.todo-title')].some((e) => e.textContent === 'Call plumber'));
  check('R5 Yes removes TODO', true);
  const srv3 = await (await page.request.get('http://localhost:8000/api/todos')).json();
  check('R5 delete persisted in the API', !srv3.some((t) => t.title === 'Call plumber'));

  // 404 path: delete behind the UI's back then toggle
  const ghost = srv3.find((t) => t.title === 'Write report');
  await page.request.delete(`http://localhost:8000/api/todos/${ghost.id}`);
  await page.getByRole('checkbox', { name: 'Mark “Write report” as completed' }).click();
  const ghostErr = page.locator('li.todo', { hasText: 'Write report' }).locator('.field-error');
  await ghostErr.waitFor();
  info(`toggle on a TODO deleted elsewhere shows: "${await ghostErr.textContent()}" and the row stays in the list until reload`);
  check('API 404 surfaced in UI with meaningful text', (await ghostErr.textContent()) === 'This task no longer exists.', await ghostErr.textContent());
  await page.reload();
  await page.locator('.todo-list').waitFor();
  check('R5 after reload, list matches server', JSON.stringify(await titles(page)) === JSON.stringify(['Added while filtered', 'Buy oat milk']), JSON.stringify(await titles(page)));

  // Keyboard-only: create, edit, delete with Tab/Enter/Space only
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Tab');
  let fi = await focusInfo(page);
  check('KB first Tab lands on New task input', fi.tag === 'INPUT' && fi.label === 'new-todo', JSON.stringify(fi));
  check('KB focus indicator visible on input', fi.outline.startsWith('solid'), fi.outline);
  await page.keyboard.type('Keyboard task');
  await page.keyboard.press('Enter');
  await page.getByText('Keyboard task', { exact: true }).waitFor();
  check('KB create via Enter', (await titles(page))[0] === 'Keyboard task');
  fi = await focusInfo(page);
  info(`focus after keyboard create: ${JSON.stringify(fi)}`);
  check('KB focus stays in New task input after create (can add another without re-Tabbing)', fi.tag === 'INPUT', JSON.stringify(fi));
  await page.getByLabel('New task').focus(); // recover as a keyboard user would
  // Tab: Add button, filters x3, then first row checkbox, Edit, Delete
  const order = [];
  for (let i = 0; i < 7; i++) { await page.keyboard.press('Tab'); order.push(await focusInfo(page)); }
  info('tab order after input: ' + order.map((o) => `${o.tag}:${o.label}`).join(' | '));
  check('KB visible focus outline on every tabbed control', order.every((o) => o.outline.startsWith('solid')), order.map((o) => o.outline).join(','));
  await page.screenshot({ path: `${SHOTS}/1280-keyboard-focus.png` });
  check('KB reached Edit “Keyboard task”', order[6].label === 'Edit “Keyboard task”' || order[5].label === 'Edit “Keyboard task”', JSON.stringify(order.slice(4)));
  // ensure we are on the Edit button
  while ((await focusInfo(page)).label !== 'Edit “Keyboard task”') await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  fi = await focusInfo(page);
  check('KB Enter on Edit opens editor with focus in field', fi.tag === 'INPUT' && fi.label.startsWith('todo-edit-'), JSON.stringify(fi));
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Keyboard task edited');
  await page.keyboard.press('Enter');
  await page.getByText('Keyboard task edited', { exact: true }).waitFor();
  check('KB edit saved with Enter', true);
  fi = await focusInfo(page);
  info(`focus after keyboard save: ${JSON.stringify(fi)}`);
  check('KB focus kept on a control in the row after Save (not lost to <body>)', fi.tag !== 'BODY', JSON.stringify(fi));
  // Toggle with Space
  await page.getByRole('checkbox', { name: 'Mark “Keyboard task edited” as completed' }).focus();
  await page.keyboard.press('Space');
  await page.getByRole('checkbox', { name: 'Mark “Keyboard task edited” as active' }).waitFor();
  check('KB Space toggles completion', true);
  fi = await focusInfo(page);
  check('KB focus stays on checkbox after toggle', fi.tag === 'INPUT' && fi.label.includes('Keyboard task edited'), JSON.stringify(fi));
  await page.getByRole('checkbox', { name: 'Mark “Keyboard task edited” as active' }).focus(); // re-focus: focus was lost
  await page.keyboard.press('Space');
  await page.getByRole('checkbox', { name: 'Mark “Keyboard task edited” as completed' }).waitFor();
  // Delete via keyboard
  await page.getByRole('button', { name: 'Delete “Keyboard task edited”' }).focus();
  await page.keyboard.press('Enter');
  fi = await focusInfo(page);
  info(`focus after pressing Delete (confirm shown): ${JSON.stringify(fi)}`);
  check('KB focus moves into the delete confirmation (not lost to <body>)', fi.tag !== 'BODY', JSON.stringify(fi));
  const yes = page.getByRole('button', { name: 'Yes, delete “Keyboard task edited”' });
  if (fi.tag === 'BODY') {
    // Recover the way a keyboard user would: Tab from the start of the page until Yes is focused
    let n = 0;
    while (!(await yes.evaluate((e) => e === document.activeElement)) && n++ < 30) await page.keyboard.press('Tab');
    info(`needed ${n} Tab presses from <body> to reach Yes`);
  }
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => ![...document.querySelectorAll('.todo-title')].some((e) => e.textContent.startsWith('Keyboard task')));
  check('KB delete via Enter on Yes', true);
  fi = await focusInfo(page);
  info(`focus after keyboard delete: ${JSON.stringify(fi)}`);
  check('KB focus not lost to <body> after delete', fi.tag !== 'BODY', JSON.stringify(fi));

  // Seed a realistic list for screenshots and persistence
  for (const t of ['Prepare sprint demo', 'Review pull request #4', 'A very long title that keeps going to check wrapping on narrow screens without breaking the layout ok']) {
    await input.fill(t); await input.press('Enter'); await page.getByText(t, { exact: true }).waitFor();
  }
  await page.getByRole('checkbox', { name: 'Mark “Review pull request #4” as completed' }).click();
  await page.getByRole('checkbox', { name: 'Mark “Review pull request #4” as active' }).waitFor();
  await page.screenshot({ path: `${SHOTS}/1280-list.png`, fullPage: true });

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  const mp = await mobile.newPage();
  await mp.goto(APP);
  await mp.locator('.todo-list').waitFor();
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('R7 no horizontal overflow at 375 px', overflow <= 0, `scrollWidth exceeds by ${overflow}px`);
  const small = await mp.evaluate(() => [...document.querySelectorAll('button, input')].map((e) => { const r = e.getBoundingClientRect(); return { l: e.getAttribute('aria-label') || e.textContent, h: Math.round(r.height), w: Math.round(r.width) }; }).filter((x) => x.h < 24 || x.w < 24));
  info('controls under 24px at 375px: ' + JSON.stringify(small));
  await mp.screenshot({ path: `${SHOTS}/375-list.png`, fullPage: true });
  await mp.getByRole('button', { name: 'Edit “Prepare sprint demo”' }).click();
  await mp.screenshot({ path: `${SHOTS}/375-edit.png`, fullPage: true });
  await mp.getByRole('button', { name: 'Cancel' }).click();
  await mp.getByRole('button', { name: 'Delete “Prepare sprint demo”' }).click();
  await mp.screenshot({ path: `${SHOTS}/375-delete-confirm.png`, fullPage: true });
  await mp.getByRole('button', { name: 'No, keep “Prepare sprint demo”' }).click();
  await mp.getByLabel('New task').fill(' ');
  await mp.getByRole('button', { name: 'Add', exact: true }).click();
  await mp.screenshot({ path: `${SHOTS}/375-validation.png`, fullPage: true });
  await mobile.close();

  // Accessibility basics
  const a11y = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    h1: document.querySelectorAll('h1').length,
    main: document.querySelectorAll('main').length,
    unlabeled: [...document.querySelectorAll('input, button')].filter((e) => !(e.getAttribute('aria-label') || e.labels?.length || e.textContent.trim())).length,
  }));
  info('a11y: ' + JSON.stringify(a11y));
  check('R7 every input/button has an accessible name', a11y.unlabeled === 0);
  check('R7 semantic landmarks (main, h1, html lang)', a11y.main === 1 && a11y.h1 === 1 && !!a11y.lang, JSON.stringify(a11y));

  const final = await (await page.request.get('http://localhost:8000/api/todos')).json();
  fs.writeFileSync(STATE, JSON.stringify(final.map(({ id, title, completed }) => ({ id, title, completed })), null, 1));
  info(`saved ${final.length} expected todos for persistence checks`);
  const unexpected = consoleErrors.filter((e) => !e.startsWith('Failed to load resource'));
  info(`browser logged ${consoleErrors.length - unexpected.length} "Failed to load resource" lines for the intentional 422/404 responses`);
  check('No unexpected browser console errors', unexpected.length === 0, unexpected.join(' | '));
  await ctx.close();
}

async function verify(browser, label) {
  const expected = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  await page.locator('.todo-list').waitFor();
  await page.reload();
  await page.locator('.todo-list').waitFor();
  const ui = await page.locator('.todo-list li.todo').evaluateAll((lis) => lis.map((li) => ({ title: li.querySelector('.todo-title').textContent, completed: li.querySelector('input[type=checkbox]').checked })));
  check(`Persistence (${label}): UI after reload shows same titles, order and completion`, JSON.stringify(ui) === JSON.stringify(expected.map(({ title, completed }) => ({ title, completed }))), JSON.stringify(ui));
  await page.screenshot({ path: `${SHOTS}/1280-after-${label}.png`, fullPage: true });
  await ctx.close();
}

async function apiDown(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(APP);
  const alert = page.getByRole('alert');
  await alert.waitFor();
  const text = (await alert.textContent()).trim();
  info(`error text with API stopped: "${text}"`);
  check('R1 error state shown when API is down', text.startsWith('Could not load tasks.'), text);
  check('R1 Retry button present', await page.getByRole('button', { name: 'Retry' }).isVisible());
  await page.screenshot({ path: `${SHOTS}/1280-error-retry.png` });
  const mp = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true });
  const m = await mp.newPage(); await m.goto(APP); await m.getByRole('alert').waitFor();
  await m.screenshot({ path: `${SHOTS}/375-error-retry.png` }); await mp.close();
  // Retry while still down stays in error
  await page.getByRole('button', { name: 'Retry' }).click();
  await page.getByRole('button', { name: 'Retry' }).waitFor();
  check('R1 Retry while still down returns to error state', true);
  // Bring API back, Retry recovers
  const api = spawn('.venv/bin/uvicorn', ['app.main:app', '--port', '8000'], { cwd: process.env.API_DIR, stdio: ['ignore', fs.openSync(process.env.API_LOG, 'a'), fs.openSync(process.env.API_LOG, 'a')], detached: true });
  api.unref();
  for (let i = 0; i < 50; i++) { try { if ((await page.request.get('http://localhost:8000/api/health')).ok()) break; } catch {} await page.waitForTimeout(200); }
  await page.getByRole('button', { name: 'Retry' }).press('Enter');
  await page.locator('.todo-list').waitFor();
  check('R1 Retry (via keyboard) recovers once the API is back', await page.locator('.todo-list').isVisible());
  await ctx.close();
}

async function mongoDown(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const t0 = Date.now();
  await page.goto(APP);
  await page.getByRole('alert').waitFor({ timeout: 20000 });
  info(`with mongod stopped and API up, error appeared after ${Date.now() - t0} ms: "${(await page.getByRole('alert').textContent()).trim()}"`);
  check('R1 error state when database is down', true);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    if (phase === 'main') await main(browser);
    else if (phase.startsWith('verify:')) await verify(browser, phase.slice(7));
    else if (phase === 'apidown') await apiDown(browser);
    else if (phase === 'mongodown') await mongoDown(browser);
  } catch (e) { fail++; console.log('FAIL exception: ' + e.message.split('\n')[0]); }
  await browser.close();
  console.log(`\n${phase}: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
```

</details>
