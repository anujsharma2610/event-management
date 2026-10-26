# Event Management Application

A complete, production-grade Event Management application featuring an in-memory Python FastAPI REST API and a React TypeScript Single Page Application built with Vite.

![Event Management UI](docs/screenshots/events.png)

## Overview

This application fulfills all requirements of the Event Management assessment:
- **Event Lifecycle**: Standard CRUD operations for events (create, read/list, full update, delete).
- **Attendee Registrations**: Atomic registration and unregistration for events.
- **Business Rule Enforcement**:
  - Registration is strictly prohibited for past or started events (`date <= now`).
  - Strict maximum capacity enforcement under thread-safe atomic critical sections (`EVENT_FULL`).
  - Prevention of duplicate registrations for the same user on an event (`ALREADY_REGISTERED`).
  - Rejection of capacity reductions below the current number of registered attendees (`CAPACITY_BELOW_REGISTRATIONS`).
  - Cascading deletion of registrations upon event deletion.
- **In-Memory Storage**: Thread-safe in-memory dictionaries synchronized with a shared `threading.Lock`.
- **Consistent Error Contract**: Standardized JSON error envelope for all failures (400, 404, 409, 422, 500).
- **Timezone Awareness**: Full UTC normalization on backend with browser timezone conversion in the frontend.
- **Modern Accessible UI (Mobbin Patterns)**: Inspired by patterns from Luma, Eventbrite, Partiful, and Circle, including calendar date tiles, capacity gauges, occupancy indicators, category filtering, avatar attendee rosters, and interactive demo identity controls. See [docs/ui-design.md](docs/ui-design.md) for full design documentation.

| Desktop Event Directory | Mobile Event Directory |
|---|---|
| ![Event Directory Desktop](docs/screenshots/events.png) | ![Event Directory Mobile](docs/screenshots/events-mobile.png) |

| Desktop Event Detail | Mobile Event Detail |
|---|---|
| ![Event Detail Desktop](docs/screenshots/event-detail.png) | ![Event Detail Mobile](docs/screenshots/event-detail-mobile.png) |

| Create / Edit Event Form |
|---|
| ![Event Form Desktop](docs/screenshots/event-form.png) |

---

## Tested Runtime Environment

The application was built and validated against the following runtimes:
- **Python**: 3.14.2 (compatible with Python >= 3.12)
- **Node.js**: v22.22.3
- **npm**: 10.9.8
- **OS**: macOS (Apple Silicon arm64)

---

## Architecture & Directory Layout

```text
event-management/
├── .github/
│   └── workflows/
│       └── ci.yml                      # GitHub Actions CI workflow (Pytest, Ruff, ESLint, Typecheck, Build)
├── docs/
│   ├── decisions.md                    # Architecture and implementation decisions
│   ├── demo.md                         # Detailed step-by-step demonstration walkthrough
│   ├── ui-design.md                    # Mobbin design research, patterns, and decisions
│   └── screenshots/
│       ├── events.png                  # Screenshot of event directory (Desktop)
│       ├── events-mobile.png           # Screenshot of event directory (Mobile)
│       ├── event-detail.png            # Screenshot of event detail & attendee management (Desktop)
│       ├── event-detail-mobile.png     # Screenshot of event detail & attendee management (Mobile)
│       └── event-form.png              # Screenshot of create/edit event form (Desktop)
├── backend/
│   ├── pyproject.toml                  # Backend project metadata, dependencies & tool configs
│   ├── requirements.txt                # Pinned production runtime dependencies
│   ├── requirements-dev.txt            # Pinned development and testing dependencies
│   ├── .env.example                    # Sample environment variables
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # FastAPI app factory, CORS, exception handlers
│   │   ├── models.py                   # Frozen dataclass domain entities
│   │   ├── schemas.py                  # Pydantic v2 validation contracts & response schemas
│   │   ├── errors.py                   # Domain exceptions & error codes
│   │   ├── store.py                    # Thread-safe in-memory store
│   │   ├── service.py                  # Atomic business logic & clock integration
│   │   ├── seed.py                     # Startup demo data seeder (relative dates)
│   │   └── api/
│   │       ├── __init__.py
│   │       └── events.py               # REST route handlers
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py                 # Pytest fixtures (fresh store, fake clock, TestClient)
│       ├── test_health.py              # Health check & app isolation tests
│       ├── test_service.py             # Business rule unit tests & schema validation tests
│       ├── test_concurrency.py         # Thread barrier concurrency & race condition tests
│       └── test_api.py                 # HTTP contract & status code tests
└── frontend/
    ├── package.json                    # Scripts and dependencies (React 19, Vite, Vitest)
    ├── package-lock.json               # Deterministic dependency tree
    ├── .env.example                    # Frontend environment configuration
    ├── vite.config.ts                  # Vite & Vitest configuration
    ├── tsconfig.json                   # TypeScript configuration
    ├── eslint.config.js                # ESLint flat config
    ├── index.html                      # HTML entrypoint
    └── src/
        ├── api/
        │   ├── client.ts               # Resilient fetch client with error normalization
        │   └── types.ts                # TypeScript interfaces matching backend contracts
        ├── components/
        │   ├── EventForm.tsx           # Create / Edit event form with timezone handling
        │   ├── EventForm.test.tsx      # Event form component unit tests
        │   └── AttendeeControls.tsx    # Demo attendee registration controls
        ├── pages/
        │   ├── EventListPage.tsx       # Event directory with status badges and actions
        │   ├── EventDetailPage.tsx     # Details, attendee roster, and action controls
        │   ├── EventDetailPage.test.tsx# Event detail component unit tests
        │   └── EventFormPage.tsx       # Routed create / edit container
        ├── utils/
        │   ├── avatar.ts               # Deterministic attendee avatar generation
        │   ├── date.ts                 # Timezone-aware date parsing and conversion utilities
        │   └── date.test.ts            # Date utility unit tests
        ├── App.tsx                     # React Router routes and header navigation
        ├── main.tsx                    # React DOM entrypoint
        ├── styles.css                  # Modern, accessible, responsive styling
        ├── vite-env.d.ts               # Vite client environment types
        └── test/
            └── setup.ts                # Vitest & Jest DOM setup
```

---

## Quick Start (Two Terminals)

### Terminal 1: Backend API

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install pinned dependencies:
   ```bash
   pip install -r requirements-dev.txt
   ```
4. Start the Uvicorn server:
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
   ```
   > **Note on Storage & Concurrency**: Always run with `--workers 1`. The application state resides entirely in the Python process memory. Using multiple worker processes would isolate memory across workers.
   >
   > To start with sample demo events pre-seeded (using startup-relative dates), set `SEED_DEMO_DATA=true`:
   > ```bash
   > SEED_DEMO_DATA=true python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
   > ```

Development URLs:
- **API Root**: `http://127.0.0.1:8000`
- **Interactive Swagger Docs**: `http://127.0.0.1:8000/docs`
- **OpenAPI Schema**: `http://127.0.0.1:8000/openapi.json`
- **Health Check**: `http://127.0.0.1:8000/health`

### Terminal 2: Frontend Web Application

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm ci
   ```
3. Start the Vite development server:
   ```bash
   npm run dev -- --host 127.0.0.1
   ```

Open `http://127.0.0.1:5173` in your browser.

---

## REST API Specification

### Endpoints

| Method | Path | Description | Success | Common Failure Codes |
|---|---|---|---|---|
| `GET` | `/health` | Service health status | `200 OK` | - |
| `GET` | `/api/events` | List all events (sorted by date, id) | `200 OK` | `500 INTERNAL_ERROR` |
| `POST` | `/api/events` | Create a new event | `201 Created` (`Location`) | `400 INVALID_JSON`, `422 VALIDATION_ERROR` |
| `GET` | `/api/events/{id}` | Get event details by ID | `200 OK` | `404 EVENT_NOT_FOUND`, `422 VALIDATION_ERROR` |
| `PUT` | `/api/events/{id}` | Replace all writable event fields | `200 OK` | `404`, `409 CAPACITY_BELOW_REGISTRATIONS`, `422` |
| `DELETE` | `/api/events/{id}` | Delete event and its registrations | `204 No Content` | `404 EVENT_NOT_FOUND`, `422 VALIDATION_ERROR` |
| `GET` | `/api/events/{id}/registrations` | List attendees registered for event | `200 OK` | `404 EVENT_NOT_FOUND`, `422 VALIDATION_ERROR` |
| `POST` | `/api/events/{id}/registrations` | Register attendee (`userId`) | `201 Created` (`Location`) | `404`, `409 EVENT_STARTED`, `409 ALREADY_REGISTERED`, `409 EVENT_FULL` |
| `DELETE` | `/api/events/{id}/registrations/{userId}` | Unregister attendee | `204 No Content` | `404 EVENT_NOT_FOUND`, `422 VALIDATION_ERROR` |

### Consistent Error Envelope

All HTTP errors return a standardized envelope:
```json
{
  "error": {
    "code": "EVENT_FULL",
    "message": "This event has reached capacity.",
    "details": []
  }
}
```

Validation errors (HTTP 422) provide field-level details:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "title",
        "message": "Title cannot be empty or whitespace only."
      }
    ]
  }
}
```

---

## Example cURL Commands

### 1. Health Check
```bash
curl -s http://127.0.0.1:8000/health
```

### 2. Create an Event
```bash
curl -i -X POST http://127.0.0.1:8000/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cloud Architecture Summit 2030",
    "description": "Deep dive into event-driven systems and microservices.",
    "date": "2030-06-15T13:00:00Z",
    "maxCapacity": 2
  }'
```
*Note the returned `201 Created` status and `Location: /api/events/{id}` header.*

### 3. List Events
```bash
curl -s http://127.0.0.1:8000/api/events
```

### 4. Register an Attendee
```bash
curl -i -X POST http://127.0.0.1:8000/api/events/{eventId}/registrations \
  -H "Content-Type: application/json" \
  -d '{"userId": "attendee-001"}'
```

### 5. Attempt Duplicate Registration (Observe 409 Conflict)
```bash
curl -i -X POST http://127.0.0.1:8000/api/events/{eventId}/registrations \
  -H "Content-Type: application/json" \
  -d '{"userId": "attendee-001"}'
```
*Returns `409 Conflict` with code `ALREADY_REGISTERED`.*

### 6. Fill Capacity and Attempt Overbooking (Observe 409 Conflict)
```bash
# Register second attendee to reach capacity (maxCapacity was 2)
curl -i -X POST http://127.0.0.1:8000/api/events/{eventId}/registrations \
  -H "Content-Type: application/json" \
  -d '{"userId": "attendee-002"}'

# Attempt third attendee
curl -i -X POST http://127.0.0.1:8000/api/events/{eventId}/registrations \
  -H "Content-Type: application/json" \
  -d '{"userId": "attendee-003"}'
```
*Returns `409 Conflict` with code `EVENT_FULL`.*

### 7. Unregister an Attendee
```bash
curl -i -X DELETE http://127.0.0.1:8000/api/events/{eventId}/registrations/attendee-001
```
*Returns `204 No Content` with an empty body. Repeating this request also returns `204 No Content`.*

### 8. Update Event (Full PUT)
```bash
curl -i -X PUT http://127.0.0.1:8000/api/events/{eventId} \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cloud Architecture Summit 2030 (Updated)",
    "description": "Expanded venue with additional breakout sessions.",
    "date": "2030-06-16T10:00:00Z",
    "maxCapacity": 50
  }'
```

### 9. Delete Event
```bash
curl -i -X DELETE http://127.0.0.1:8000/api/events/{eventId}
```
*Returns `204 No Content`. Event and all its registrations are deleted.*

---

## Verification & Test Execution

### Backend Verification
From `backend/` with virtual environment activated:
```bash
# Run unit, API contracts, and barrier concurrency tests (34 tests)
pytest -v

# Run Ruff linter check
ruff check .

# Run Ruff code formatter check
ruff format --check .
```

### Frontend Verification
From `frontend/`:
```bash
# Run Vitest component & date utility tests (11 tests)
npm run test

# Run TypeScript typecheck
npm run typecheck

# Run ESLint check
npm run lint

# Run production build
npm run build
```

---

## Design Assumptions & Known Limitations

1. **In-Memory Volatility**: All event and registration data is stored in Python heap memory dictionaries. Restarting or reloading the server process resets all data.
2. **Single-Worker Execution**: Because state is kept in memory, the backend must run on a single worker process (`--workers 1`). Multi-worker deployments would create isolated memory partitions.
3. **Identity & Authentication**: Authentication and authorization are out of scope. The caller supplies an alphanumeric `userId` string (`1-64` characters `[A-Za-z0-9_-]`). The UI provides a Demo Attendee ID switcher to test multi-user scenarios.
4. **Collection Pagination**: Events and registrations are unpaginated for this exercise. For large production deployments, cursor-based pagination and database indexing would be used.
5. **Event Start Time**: Event `date` represents the start time instant. New registrations close once `date <= now`. Existing attendees may still unregister after the start time.
