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
- **Validation**: Trimmed, non-empty, 1–64 characters matching regex `^[A-Za-z0-9_-]+$`. Case is preserved.
- **Frontend Demo Identity**: The frontend provides a clearly labeled "Demo Attendee ID" input defaulting to `attendee-001`, allowing reviewers to simulate multiple attendees registering and unregistering.

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
