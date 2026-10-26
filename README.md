# Event Management Application

A complete, production-grade Event Management application featuring an in-memory Python FastAPI REST API and a React TypeScript Single Page Application built with Vite.

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
- **In-Memory Storage**: Thread-safe in-memory dictionaries synchronized with `threading.Lock`.
- **Consistent Error Contract**: Standardized JSON error envelope for all failures (400, 404, 409, 422, 500).
- **Timezone Awareness**: Full UTC normalization on backend with browser timezone conversion in the frontend.
- **Accessible & Usable UI**: Loading, empty, and conflict error states with demo identity switcher.

## Tested Runtime Environment

The application was built and validated against the following runtimes:
- **Python**: 3.14.2 (compatible with Python >= 3.12)
- **Node.js**: v22.22.3
- **npm**: 10.9.8
- **OS**: macOS (Apple Silicon arm64)

## Architecture & Directory Layout

```text
event-management/
├── README.md                           # Comprehensive documentation & setup guide
├── .gitignore                          # Standard git exclusions for Python & Node
├── docs/
│   ├── decisions.md                    # Architecture and implementation decisions
│   ├── demo.md                         # Detailed step-by-step demonstration walkthrough
│   └── screenshots/                    # UI flow captures
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
│   │   ├── seed.py                     # Optional startup demo data seeder
│   │   └── api/
│   │       └── events.py               # REST route handlers
│   └── tests/
│       ├── conftest.py                 # Pytest fixtures (fresh store, fake clock, TestClient)
│       ├── test_health.py              # Health check & app isolation tests
│       ├── test_service.py             # Business rule unit tests
│       ├── test_concurrency.py         # Thread barrier concurrency & race condition tests
│       └── test_api.py                 # HTTP contract & status code tests
└── frontend/
    ├── package.json                    # Scripts and dependencies (React 19, Vite, Vitest)
    ├── package-lock.json               # Deterministic dependency tree
    ├── .env.example                    # Frontend environment configuration
    ├── vite.config.ts                  # Vite & Vitest configuration
    ├── index.html                      # HTML entrypoint
    └── src/
        ├── api/
        │   ├── client.ts               # Resilient fetch client with error normalization
        │   └── types.ts                # TypeScript interfaces matching backend contracts
        ├── components/
        │   ├── EventForm.tsx           # Create / Edit event form with timezone handling
        │   └── AttendeeControls.tsx    # Demo attendee registration controls
        ├── pages/
        │   ├── EventListPage.tsx       # Event directory with status badges and actions
        │   ├── EventDetailPage.tsx     # Details, attendee roster, and action controls
        │   └── EventFormPage.tsx       # Routed create / edit container
        ├── App.tsx                     # React Router routes and header navigation
        ├── main.tsx                    # React DOM entrypoint
        ├── styles.css                  # Modern, accessible, responsive styling
        └── test/
            └── setup.ts                # Vitest & Jest DOM setup
```

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
   > **Note**: Always run with `--workers 1` because the application state resides in process memory. Using multiple worker processes would isolate memory across workers.

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

### Standard Error Envelope

All HTTP errors return a consistent envelope:
```json
{
  "error": {
    "code": "EVENT_FULL",
    "message": "This event has reached capacity.",
    "details": []
  }
}
```

---

## Verification & Test Commands

### Backend Verification
From `backend/` with `.venv` active:
```bash
# Run complete test suite (unit, API contracts, thread concurrency)
pytest -v

# Run linting check
ruff check .

# Run code format check
ruff format --check .
```

### Frontend Verification
From `frontend/`:
```bash
# Run unit & component tests
npm run test

# Run TypeScript type check
npm run typecheck

# Run ESLint
npm run lint

# Run production build
npm run build
```

---

## Design Assumptions & Known Limitations

1. **In-Memory Volatility**: All event and registration data is stored in Python heap memory. Restarting or reloading the server process resets all data.
2. **Single-Worker Execution**: Because state is in-memory, the backend must run on a single worker (`--workers 1`). Multi-worker deployments would create isolated memory partitions.
3. **Identity & Authentication**: Authentication and authorization are explicitly out of scope. The caller supplies a `userId` string (`1-64` alphanumeric characters). Any caller can register or unregister any attendee.
4. **Collection Pagination**: Events and registrations are unpaginated for this exercise. For large production deployments, cursor-based pagination and database indexing would be used.
5. **Event Start Time**: Event `date` represents the start time instant. New registrations close once `date <= now`. Existing attendees may still unregister after start time.
