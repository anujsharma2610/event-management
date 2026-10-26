# Review Findings and Hardening Log

This document records the confirmed findings, root causes, fix decisions, regression tests, and resolution statuses for the deep review pass of the Event Management application (starting snapshot `bcf7153`).

---

## Summary of Findings

| ID | Title | Severity | Confidence | Status |
|---|---|---|---|---|
| **F01** | Registration errors disappear and selected identity resets during refresh | P1 | High (Reproduced) | Resolved & Verified |
| **F02** | Attendee roster unregister has no local failure handling or pending state | P1 | High (Reproduced) | Resolved & Verified |
| **F03** | Timezone normalization turns extreme valid dates into 500 server errors | P2 | High (Reproduced) | Resolved & Verified |
| **F04** | Backend test isolation broken by caller environment `SEED_DEMO_DATA=true` | P2 | High (Reproduced) | Resolved & Verified |
| **F05** | HTTP error handler discards protocol headers (e.g. `Allow` on 405) | P2 | High (Reproduced) | Resolved & Verified |
| **F06** | OpenAPI specification omits 400 `INVALID_JSON` responses on PUT and POST | P2 | High (Reproduced) | Resolved & Verified |
| **F07** | Editing an event silently truncates seconds and fractional timestamp precision | P2 | High (Reproduced) | Resolved & Verified |
| **F08** | Delete event confirmation dialog lacks accessible keyboard modal behavior | P2 | High (Reproduced) | Resolved & Verified |
| **F09** | Navigating from edit to create retains previous event form values | P1 | High (Reproduced) | Resolved & Verified |
| **F10** | Existing test assertions overstate verified postconditions | P2 | High (Verified) | Resolved & Verified |
| **F11** | Unverified production/contrast claims and semantic filter tab roles | P3 | High (Verified) | Resolved & Verified |
| **F12** | Unexpected server errors (500) lose CORS headers for browser clients | P2 | High (Reproduced) | Resolved & Verified |

---

## Detailed Findings

### F01: Registration errors disappear and selected identity resets during refresh
- **Severity**: P1
- **Confidence**: High (Reproduced with deferred network probes)
- **Source References**:
  - `frontend/src/pages/EventDetailPage.tsx`
  - `frontend/src/components/AttendeeControls.tsx`
- **Expected Behavior**: When an attendee registration or unregistration fails (e.g. 409 `EVENT_FULL`, `ALREADY_REGISTERED`, `EVENT_STARTED`), or succeeds, the selected identity (e.g. `attendee-002`) must remain selected. The error message must remain visible and legible to the user. Background data revalidation must not unmount controls or wipe out user context.
- **Actual Behavior**: Handlers invoked `loadData()` in a `finally` block. `loadData()` set `isLoading = true`, which rendered only `<div className="loading-card">Loading event details...</div>`, unmounting `AttendeeControls`. Its local state (`demoUserId` and `errorMessage`) was destroyed. Upon refresh completion, `AttendeeControls` remounted with default `attendee-001`, and the error message was lost.
- **Fix Decision**:
  - Separate initial page load (`isLoading`) from background revalidations (`isRefreshing`).
  - Keep the detail view and `AttendeeControls` mounted during background revalidations.
  - Lift/preserve `selectedUserId` and mutation feedback across refreshes.
  - Separate mutation errors from background refresh errors.
- **Regression Tests**:
  - `frontend/src/pages/EventDetailPage.test.tsx`:
    - "preserves selected attendee identity after successful registration and refresh"
    - "retains mutation conflict error message after delayed background refresh"

---

### F02: Attendee roster unregister has no local failure handling or pending state
- **Severity**: P1
- **Confidence**: High (Source inspection and runtime probe)
- **Source References**:
  - `frontend/src/pages/EventDetailPage.tsx`
- **Expected Behavior**: Clicking "Unregister" in the attendee roster provides immediate pending feedback for that specific attendee, disables the button during in-flight network request to prevent duplicate requests, catches any API or network errors, and displays an actionable error message without an unhandled promise rejection.
- **Actual Behavior**: The roster button called an inline async handler without `try/catch`. Rejections triggered an unhandled promise rejection in the browser console. No pending state was displayed for the specific roster item, and the entire page unmounted during `loadData()`.
- **Fix Decision**:
  - Manage a shared mutation handler with `try/catch/finally`.
  - Track `unregisteringUserId` state to disable the specific button and display "Removing...".
  - Display mutation error banner prominently on the page.
- **Regression Tests**:
  - `frontend/src/pages/EventDetailPage.test.tsx`:
    - "handles roster unregister failure gracefully without unhandled rejection"
    - "disables roster unregister button while mutation is pending"

---

### F03: Timezone normalization turns extreme valid dates into 500 server errors
- **Severity**: P2
- **Confidence**: High (Reproduced via TestClient)
- **Source References**:
  - `backend/app/schemas.py:75-78`
- **Expected Behavior**: Client-supplied ISO dates with extreme offsets or boundaries (e.g. `0001-01-01T00:00:00+01:00` or `9999-12-31T23:59:59-01:00`) that cannot be represented in UTC within Python's datetime bounds (`1 <= year <= 9999`) must fail request validation and return HTTP 422 `VALIDATION_ERROR` with a clear field error message.
- **Actual Behavior**: The string was parsed successfully by `datetime.fromisoformat()`, but `dt.astimezone(UTC)` raised `OverflowError: date value out of range`. Because this exception was outside the caught parsing exceptions, it escaped to FastAPI's general exception handler and returned HTTP 500 `INTERNAL_ERROR`.
- **Fix Decision**:
  - Catch `OverflowError` during UTC normalization and convert it to a `ValueError("Date exceeds representable UTC range (year 1 to 9999).")` so Pydantic returns HTTP 422.
  - Also ensure dates maintain valid year range.
- **Regression Tests**:
  - `backend/tests/test_api.py`:
    - `test_create_event_extreme_offset_date_returns_422`
    - `test_put_event_extreme_offset_date_returns_422`

---

### F04: Backend test isolation broken by caller environment `SEED_DEMO_DATA=true`
- **Severity**: P2
- **Confidence**: High (Reproduced via `SEED_DEMO_DATA=true pytest`)
- **Source References**:
  - `backend/app/main.py:163-167`
  - `backend/tests/conftest.py:32-35`
- **Expected Behavior**: Running backend tests must succeed deterministically regardless of whether `SEED_DEMO_DATA` is set in the developer's shell environment. Test fixtures injecting fresh stores must not have unintended seed records injected.
- **Actual Behavior**: `create_app()` unconditionally checked `os.getenv("SEED_DEMO_DATA")`. When running tests with `SEED_DEMO_DATA=true`, 3 demo events were seeded into the test app, causing `test_list_events_endpoint` to assert 2 events but receive 5.
- **Fix Decision**:
  - Add explicit parameter `seed_demo_data: bool | None = None` to `create_app()`.
  - When `seed_demo_data is None`, fallback to `os.getenv("SEED_DEMO_DATA")`.
  - In `backend/tests/conftest.py`, pass `seed_demo_data=False` for all test client fixtures.
  - Add unit tests verifying `seed_demo_data=True` and `seed_demo_data=False` behaviors explicitly.
- **Regression Tests**:
  - `backend/tests/test_health.py`:
    - `test_app_factory_seed_demo_data_isolation`
    - `test_app_factory_respects_explicit_seed_parameter`

---

### F05: HTTP error handler discards protocol headers (e.g. `Allow` on 405)
- **Severity**: P2
- **Confidence**: High (Reproduced via `PATCH /api/events`)
- **Source References**:
  - `backend/app/main.py:127-138`
- **Expected Behavior**: When an HTTP error occurs that carries standard protocol headers (such as `Allow: GET, POST, OPTIONS` on HTTP 405 Method Not Allowed), the error handler must preserve those headers in the returned `JSONResponse`.
- **Actual Behavior**: `http_exception_handler` constructed a new `JSONResponse` without copying `exc.headers`. As a result, `PATCH /api/events` returned 405 with `Allow: None`.
- **Fix Decision**:
  - In `http_exception_handler`, pass `headers=exc.headers` to `JSONResponse`.
- **Regression Tests**:
  - `backend/tests/test_api.py`:
    - `test_unsupported_method_preserves_allow_header`

---

### F06: OpenAPI specification omits 400 `INVALID_JSON` responses on PUT and POST
- **Severity**: P2
- **Confidence**: High (Reproduced via schema inspection and probe)
- **Source References**:
  - `backend/app/api/events.py`
- **Expected Behavior**: All endpoints accepting request bodies (`POST /api/events`, `PUT /api/events/{id}`, `POST /api/events/{id}/registrations`) must document HTTP 400 `INVALID_JSON` in their OpenAPI response maps.
- **Actual Behavior**: `PUT /api/events/{id}` and `POST /api/events/{id}/registrations` documented 404, 409, 422, but omitted 400.
- **Fix Decision**:
  - Add `400: {"model": ErrorEnvelope, "description": "Malformed JSON body."}` to `PUT /api/events/{id}` and `POST /api/events/{id}/registrations`.
  - Add tests verifying the generated `/openapi.json` contract for all body endpoints.
- **Regression Tests**:
  - `backend/tests/test_api.py`:
    - `test_openapi_documents_malformed_json_on_all_body_routes`

---

### F07: Editing an event silently truncates seconds and fractional timestamp precision
- **Severity**: P2
- **Confidence**: High (Reproduced via probe)
- **Source References**:
  - `frontend/src/utils/date.ts:23-34`
  - `frontend/src/components/EventForm.tsx:29-38`
- **Expected Behavior**: When an event was created with second or millisecond precision (e.g. `2030-06-15T13:00:45.123Z`), and an editor modifies only the title or capacity without altering the date, the saved event must retain its exact original ISO timestamp without losing seconds or milliseconds.
- **Actual Behavior**: `isoUtcToLocalInput` formatted only up to minutes (`YYYY-MM-DDTHH:mm`). Upon submission, `EventForm` unconditionally converted the truncated input string back to ISO UTC, zeroing out seconds and milliseconds and unintentionally shifting the cutoff time.
- **Fix Decision**:
  - In `EventForm`, compare the current date input with the formatted initial date. If unchanged, retain the exact raw `initialValues.date` string in the submission payload.
  - If the user explicitly changed the date input, convert the new value to ISO UTC.
- **Regression Tests**:
  - `frontend/src/components/EventForm.test.tsx`:
    - "preserves exact seconds and fractional precision when date is untouched"
    - "updates timestamp when date is explicitly modified by user"

---

### F08: Delete event confirmation dialog lacks accessible keyboard modal behavior
- **Severity**: P2
- **Confidence**: High (Source inspection and DOM verification)
- **Source References**:
  - `frontend/src/pages/EventDetailPage.tsx`
- **Expected Behavior**: A modal confirmation dialog must autofocus a safe initial action (Cancel button) when opened, trap Tab navigation within its focusable elements, dismiss on Escape key press, return focus to the delete trigger button upon closing, and have proper ARIA attributes (`aria-labelledby`, `aria-describedby`).
- **Actual Behavior**: The dialog was rendered as a plain `div` with `role="dialog"` without focus trapping, Escape dismissal, initial focus management, or focus restoration.
- **Fix Decision**:
  - Implement full keyboard focus trap, Escape key listener, auto-focus on Cancel, and focus restoration to the trigger button upon close or cancel.
- **Regression Tests**:
  - `frontend/src/pages/EventDetailPage.test.tsx`:
    - "focuses cancel button and closes on escape key"
    - "traps tab focus within the confirmation dialog"

---

### F09: Navigating from edit to create retains previous event form values
- **Severity**: P1
- **Confidence**: High (Reproduced with Router probe)
- **Source References**:
  - `frontend/src/pages/EventFormPage.tsx`
- **Expected Behavior**: Navigating from `/events/:id/edit` to `/events/new` via the navigation header or links must reset the form completely to blank create state. Previous event data must never leak into a new event creation.
- **Actual Behavior**: `EventFormPage` returned early from `useEffect` when `id` was undefined without resetting `initialValues` or `loadError`. React Router reused the component instance, so `initialValues` remained set to the edited event, causing the create form to be prefilled with the old event's values.
- **Fix Decision**:
  - In `EventFormPage`, when `id` is falsy, reset `initialValues` to `undefined` and `loadError` to `null`.
  - Pass `key={id ?? 'new'}` to `EventForm` to force a clean remount and fresh initial state.
- **Regression Tests**:
  - `frontend/src/pages/EventFormPage.test.tsx`:
    - "resets form completely when navigating from edit to create"

---

### F10: Existing test assertions overstate verified postconditions
- **Severity**: P2
- **Confidence**: High (Verified by test inspection)
- **Source References**:
  - `frontend/src/pages/EventDetailPage.test.tsx`
- **Expected Behavior**: Tests must verify real postconditions (e.g. attendee roster updated in DOM, registration count incremented, remaining capacity decremented, error banners displayed upon failure).
- **Actual Behavior**: The existing test named "allows registering a new attendee and updates roster" only asserted `expect(apiClient.registerAttendee).toHaveBeenCalledWith(...)`. The mocked subsequent GET returned the same static list.
- **Fix Decision**:
  - Update tests to assert updated DOM postconditions, roster item rendering, counter updates, and error states.
- **Regression Tests**:
  - Enhanced `EventDetailPage.test.tsx` suite asserting real DOM postconditions.

---

### F11: Unverified production/contrast claims and semantic filter tab roles
- **Severity**: P3
- **Confidence**: High (Verified by CSS and markup inspection)
- **Source References**:
  - `frontend/src/styles.css`
  - `frontend/src/pages/EventListPage.tsx`
- **Expected Behavior**: Text and interactive buttons must meet WCAG AA contrast (> 4.5:1). Filter buttons should use semantic `aria-pressed` or implement complete roving tabIndex tab controls. UI copy must be factual (e.g. avoid unsupported "real time" claims).
- **Actual Behavior**:
  - Warning/amber button used `#d97706` with white text (~3.19:1 contrast).
  - Category filters declared `role="tab"` and `role="tablist"` without roving tabIndex or tabpanel associations.
  - UI copy claimed "real time updates" despite relying on explicit user interactions.
- **Fix Decision**:
  - Update amber button styling to use dark text `#1c1917` on `#f59e0b` or dark amber `#b45309` with white text (> 4.5:1 ratio).
  - Convert category filter buttons to standard buttons with `aria-pressed={activeFilter === category}`.
  - Clarify copy to state factual event management behavior.
- **Regression Tests**:
  - Tested in frontend component suite and verified CSS tokens.

---

### F12: Unexpected server errors (500) lose CORS headers for browser clients
- **Severity**: P2
- **Confidence**: High (Reproduced via TestClient with Origin header)
- **Source References**:
  - `backend/app/main.py:141-153`
- **Expected Behavior**: When an unhandled internal server error occurs (HTTP 500), the response returned to an allowed browser origin (e.g. `http://127.0.0.1:5173`) must include `Access-Control-Allow-Origin: http://127.0.0.1:5173` so the browser does not mask the server error as an opaque network failure.
- **Actual Behavior**: In Starlette/FastAPI, `ServerErrorMiddleware` sits outside `CORSMiddleware`. An unhandled exception caught by `@app.exception_handler(Exception)` generates a `JSONResponse` that bypasses `CORSMiddleware`, resulting in missing `Access-Control-Allow-Origin`.
- **Fix Decision**:
  - In `general_exception_handler`, check the request `Origin` header against `allowed_origins`. If permitted, explicitly set `Access-Control-Allow-Origin` and `Vary: Origin` on the 500 `JSONResponse`.
- **Regression Tests**:
  - `backend/tests/test_api.py`:
    - `test_unexpected_500_error_retains_cors_headers_for_allowed_origin`
    - `test_unexpected_500_error_omits_cors_headers_for_disallowed_origin`
