# QA: Remove Edit feature

**Verdict: PASS.** No defects found. Title editing is gone from the API and the UI, and create, toggle, delete, filter, keyboard use and reload persistence still work.

- Branch under test: `integration/remove-edit` at `3b07c46` (draft PR #13 into `main`)
- Checked against: `docs/api/openapi.yaml` v1.1.0 and the 2026-11-09 change log entry in `docs/PLAN.md` (R4 removed)
- Date: 2026-11-09
- Environment: Python 3.13, MongoDB 7.0.34 (conda-forge via micromamba, as in `apps/api/README.md`), Node 22, headless Chromium via preinstalled Playwright
- No app code was changed.

## 1. Automated suites

| Check | Result |
| --- | --- |
| Backend `pytest` against a real `mongod` | 59 passed |
| `npm run typecheck` | clean |
| `npm test` (Vitest) | 29 passed, 3 files |
| `npm run build` | built, JS 149.0 kB (48.3 kB gzip) |

## 2. Live PATCH rules (uvicorn :8000)

Script: [`remove-edit-patch-check.sh`](remove-edit-patch-check.sh).

| Body | Status | Result |
| --- | --- | --- |
| `{"completed":true}` / `false` | 200 | completion set; `updated_at` refreshed (10:58:52 to 10:58:58 on a later call) |
| `{}` | 422 | `completed` Field required |
| `{"foo":1}` (unknown only) | 422 | `completed` Field required |
| `completed` + unknown fields (`foo`, `id`, `created_at`) | 200 | unknown fields ignored; `id` and `created_at` unchanged |
| `{"title":"New"}` | 422 | first msg "Title cannot be changed" (also reports missing `completed`) |
| `{"title":"New","completed":true}` | 422 | "Title cannot be changed"; todo not modified |
| `title` as `null` or `""` with `completed` | 422 | "Title cannot be changed" |
| `completed` as `"true"`, `1`, `null` | 422 | strict boolean |
| `[]`, no body, malformed JSON | 422 | FastAPI list shape |
| Unknown id, valid body | 404 | `Todo not found` |
| Unknown id, body with `title` | 422 | body validated before lookup |

All responses use the contract's error shapes. Title stayed "QA patch target" throughout.

## 3. Browser (Vite :5173 proxied to the API)

Script: [`remove-edit-browser-check.js`](remove-edit-browser-check.js). All 40 checks passed (20 at 375px wide, 20 at 1280px).

- **No edit control:** no Edit, Save or Rename button, no `contenteditable`, and the only text input is the "New task" field. This holds on an empty list, with items, after double-click, F2 or Enter on a title, and after reload.
- **Create:** three tasks added with Enter.
- **Toggle:** by click and by Space; strike-through applies; the active count updates ("2 tasks left").
- **Filter:** All, Active and Completed show 3, 2 and 1 items.
- **Delete:** inline confirm moves focus to No. No returns focus to Delete, and Yes removes the item. Both were done by keyboard only.
- **Keyboard:** the tab order is New task, Add, All, Active, Completed, then a checkbox and Delete for each task. There is no edit stop, and every stop shows a visible focus ring.
- **Reload:** completed state survives reload, both when completing and when un-completing.
- **Network:** every PATCH the UI sent was exactly `{"completed": <bool>}`.
- **Other:** no horizontal overflow (`scrollWidth` equals the viewport) and no console errors.

Screenshots: `remove-edit-{375,1280}-list.png`, `-delete-confirm.png`, `-keyboard-focus.png`.

## Notes (not defects)

- A `{"title": ...}` body without `completed` returns two errors. "Title cannot be changed" comes first, which is the one the UI would show.
- A body with `title` gets 422 even for an unknown id, because validation runs before the lookup. This matches FastAPI's usual order, and the contract does not say otherwise.
- The role table in `docs/PLAN.md` lists `docs/QA_REPORT.md` as QA's only file. This report goes in `docs/qa/` as the coordinator asked.
