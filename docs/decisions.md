# Architecture and Implementation Decisions

This document records the architectural and design decisions for the Event Management API assessment, following the project specification.

## 1. Tech Stack Selection
- **Backend**: Python 3.14 (compatible with >= 3.12 requirements) with FastAPI, Pydantic v2, Uvicorn, and Pytest / HTTPX for testing.
- **Frontend**: React 19 / TypeScript with Vite, React Router for client routing, and Vitest + React Testing Library for testing.
- **Rationale**: Clean separation of API and UI; FastAPI provides schema validation, interactive OpenAPI docs (`/docs`), and direct HTTP test client; React SPA provides responsive UI for evaluators to test all required UX workflows.

## 2. In-Memory Storage & Process Concurrency
- **Decision**: Store all event records and registration records in Python in-memory dictionaries owned by the application instance:
  - `events: dict[UUID, EventRecord]`
  - `registrations: dict[UUID, dict[str, RegistrationRecord]]`
- **Locking**: A single `threading.Lock` protects all read and write operations.
- **Rationale**: FastAPI path operations without `async` run inside a thread pool. A lock guarantees mutual exclusion across concurrent threads. Critical sections are kept synchronous and free of I/O.
- **Single-Worker Constraint**: Standard process memory is isolated per process. The backend must run with `--workers 1`. Restarting or reloading the server resets all in-memory data. This is documented and by design.

## 3. Atomic Registration & Business Rules
- **Critical Section Sequence**: Inside the shared lock:
  1. Verify event exists (otherwise `404 EVENT_NOT_FOUND`).
  2. Sample the clock (`datetime.now(timezone.utc)` or injected mock clock).
  3. Reject past or started event: if `event.date <= now`, raise `409 EVENT_STARTED`.
  4. Reject duplicate attendee: if `userId` is already in `registrations[eventId]`, raise `409 ALREADY_REGISTERED`.
  5. Reject over-capacity: if `len(registrations[eventId]) >= event.max_capacity`, raise `409 EVENT_FULL`.
  6. Insert registration record and return.
- **Capacity Reduction Rule**: Updating an event's `maxCapacity` to a value lower than the current registration count is rejected with `409 CAPACITY_BELOW_REGISTRATIONS`. Updating to equal the count is permitted.
- **Deletion Cascade**: Deleting an event atomically deletes the event record and all associated registrations.

## 4. Identity & User Handling
- **Decision**: No user authentication, passwords, or persistent user accounts are implemented. Identity is caller-supplied via a `userId` string.
- **Validation**: Trimmed, non-empty, 1 to 64 characters matching regex `^[A-Za-z0-9_-]+$`. Case is preserved: `UserA` and `usera` are treated as distinct attendees.
- **Frontend Demo Identity**: The frontend provides a clearly labeled "Attendee Identity" input defaulting to `attendee-001`, allowing reviewers to simulate multiple attendees registering and unregistering.

## 5. Date & Timezone Handling
- **Storage**: All event dates and audit timestamps are stored as timezone-aware UTC datetimes.
- **Validation**: Incoming event dates must be ISO 8601 strings with an explicit timezone offset or `Z`. Naive dates and numeric timestamps are rejected.
- **Frontend Interaction**: The browser `datetime-local` input is interpreted in the user's local timezone and converted to an explicit ISO UTC string on submission. When editing an event, the UTC datetime is converted back to local wall-clock components for form prefill. The browser's active timezone is displayed to the user.

## 6. Consistent Error Envelope
- **Contract**: All error responses return:
  ```json
  {
    "error": {
      "code": "STRING_CODE",
      "message": "Human-readable description.",
      "details": []
    }
  }
  ```
- Custom exception handlers override FastAPI's default 422 `RequestValidationError`, 400 JSON parse errors, domain 404/409 errors, and 500 internal errors to ensure 100% adherence to this contract across the entire API.

## 7. HTTP Status Code Conventions
- `200 OK`: Successful retrieval or update.
- `201 Created`: Successful creation of event or registration, including `Location` header.
- `204 No Content`: Successful deletion or unregistration (empty response body). Repeating unregistration for an absent attendee returns `204` if the event exists.
- `400 Bad Request`: Malformed JSON syntax.
- `404 Not Found`: Event does not exist.
- `409 Conflict`: Business rule conflict (`EVENT_STARTED`, `ALREADY_REGISTERED`, `EVENT_FULL`, `CAPACITY_BELOW_REGISTRATIONS`).
- `422 Unprocessable Entity`: Validation failure on request body or parameters.

## 8. Hardening and Review Decisions

Following the deep review pass, the following implementation decisions were established:

1. **Protocol Header Preservation**: Starlette's `StarletteHTTPException` handler was updated to explicitly preserve `exc.headers` when returning error envelopes (for example, keeping `Allow: GET, POST, OPTIONS` on 405 Method Not Allowed responses).
2. **CORS on Unexpected 500 Errors**: In FastAPI/Starlette, `ServerErrorMiddleware` executes outside `CORSMiddleware`. The global unhandled exception handler explicitly checks the request `Origin` header against `ALLOWED_ORIGINS` and sets `Access-Control-Allow-Origin` and `Vary: Origin`, ensuring cross-origin browser clients receive structured error JSON rather than opaque network failures.
3. **Date Normalization Overflow**: Datetimes with extreme offsets (e.g. `0001-01-01T00:00:00+01:00` or `9999-12-31T23:59:59-01:00`) that overflow Python's representable range during UTC conversion are caught as `OverflowError` and mapped to `422 VALIDATION_ERROR` rather than escaping to an unhandled 500.
4. **Timestamp Precision Preservation on Edit**: Form inputs for `datetime-local` have minute granularity. When an operator updates only the title or capacity of an event that has second or fractional timestamps (e.g. `2030-06-15T13:00:45.123Z`), the frontend form checks if the date input is untouched and preserves the exact original raw UTC timestamp, preventing accidental shift of event registration cutoffs.
5. **Background Revalidation State Separation**: `EventDetailPage` separates initial loading (`isLoading = true` when no data is loaded) from background data revalidation (`isRefreshing = true`). Revalidations after mutations do not unmount attendee controls, preserving user input, typed demo identity, and visible mutation conflict banners.
6. **Accessible Modal Dialog**: The delete confirmation modal implements standard WAI-ARIA dialog practices: autofocus on Cancel, focus containment (Tab/Shift+Tab wrapping), dismissal via Escape key, and focus restoration to the trigger button upon close.
7. **Test Fixture Seed Isolation**: `create_app(seed_demo=False)` explicitly controls demo seeding, guaranteeing that setting `SEED_DEMO_DATA=true` in developer shell environments does not contaminate test fixtures or break test isolation.

## 9. Dark Mode and Appearance Architecture

1. **Three-State Preference Model**: The application supports System, Light, and Dark preferences. System defaults to the operating system setting via `window.matchMedia('(prefers-color-scheme: dark)')` and updates dynamically when the host OS appearance changes. Explicit Light or Dark choices override OS preferences until the user selects System again.
2. **Decoupled Client Persistence**: User appearance preference is persisted in browser `localStorage` under `event-management:theme`. All backend event and registration data remains strictly in volatile process memory. If storage access throws (e.g. strict privacy modes or quota restrictions), the app degrades gracefully, maintaining the chosen appearance in session state.
3. **Early Bootstrap Zero-FOUC Architecture**: To avoid an avoidable light flash when loading saved dark preferences, a small synchronous inline script in `frontend/index.html` inspects storage and media queries before stylesheet parsing and sets `data-theme="dark"` and `color-scheme: dark` immediately on the `<html>` document element.
4. **Non-Destructive State Transitions**: Theme toggles modify attributes on `document.documentElement` without remounting the React component tree. Dirty form entries, untouched ISO date strings, active attendee identity, and open confirmation modals remain completely intact when switching themes.
5. **Semantic Role Tokens**: Hardcoded surface and text colors were eliminated in favor of semantic CSS custom properties in `frontend/src/styles.css`. All token pairs satisfy WCAG 2.1 AA contrast requirements (> 4.5:1 for normal copy, > 3.0:1 for large copy and UI boundaries) across both palettes.
