# Event Management Demo Guide

This guide describes how to run and demonstrate the Event Management application.

## Prerequisites
- Python 3.12+ (tested with Python 3.14.2)
- Node.js 20.19+ or 22+ (tested with Node v22.22.3)
- npm 10+ (tested with npm 10.9.8)

## Quick Start

### 1. Start the Backend API
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
```
The API is available at:
- Base API: `http://127.0.0.1:8000`
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- OpenAPI Specification: `http://127.0.0.1:8000/openapi.json`
- Health check: `http://127.0.0.1:8000/health`

### 2. Start the Frontend Application
In a separate terminal:
```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1
```
The web application is accessible at:
- `http://127.0.0.1:5173`

## Step-by-Step Demo Walkthrough

1. **View Events (Empty State)**
   - Open `http://127.0.0.1:5173`.
   - The event list loads and presents a clean empty state with a "Create your first event" call-to-action button.

2. **Create a Future Event**
   - Click "Create Event" (or navigate to `/events/new`).
   - Fill in:
     - Title: `Tech Symposium 2030`
     - Description: `Deep dive into modern distributed systems and API architectures.`
     - Date & Time: A future date/time (e.g. tomorrow or next week). Notice the displayed browser timezone badge.
     - Maximum Capacity: `2`
   - Click "Create Event". You are redirected to the event detail page.

3. **Register Attendee 1**
   - In the "Demo Attendee ID" input, keep the default `attendee-001`.
   - Click "Register".
   - The attendee list updates immediately to show `attendee-001`, remaining capacity changes from 2 to 1, and the badge indicates remaining seats.

4. **Attempt Duplicate Registration**
   - Click "Register" again with `attendee-001`. Notice the UI shows that this attendee is already registered, and attempting registration shows the `ALREADY_REGISTERED` conflict message.

5. **Register Attendee 2 (Reach Capacity)**
   - Change "Demo Attendee ID" to `attendee-002`.
   - Click "Register".
   - Registration succeeds. Remaining capacity is now 0.
   - The event status badge updates to "Full".
   - Registration controls for new attendees are disabled with a clear explanation that capacity has been reached.

6. **Attempt Over-Capacity Registration**
   - Change "Demo Attendee ID" to `attendee-003`.
   - The register button is disabled, preventing overbooking. Attempting registration via API returns `409 EVENT_FULL`.

7. **Unregister an Attendee**
   - Switch "Demo Attendee ID" back to `attendee-001` (or click "Unregister" next to `attendee-001` in the attendee list).
   - Click "Unregister".
   - `attendee-001` is removed. Remaining capacity updates back to 1.
   - The status transitions back to "Upcoming", and registration re-opens.

8. **Register Attendee 3**
   - Switch back to `attendee-003` and click "Register".
   - `attendee-003` is successfully registered.

9. **Prevent Lowering Capacity Below Attendee Count**
   - Click "Edit Event".
   - Change Maximum Capacity to `1` (while 2 attendees are registered).
   - Click "Save Changes".
   - The server rejects the update with `409 CAPACITY_BELOW_REGISTRATIONS`, explaining that current registrations (2) exceed the requested capacity (1).

10. **Past Event Registration Rules**
    - In "Edit Event", change the date to a past date (e.g. yesterday).
    - Save changes. The event status now shows "Past".
    - Registration is permanently closed for past events.
    - However, existing attendees can still unregister if desired.

11. **Delete Event**
    - Click "Delete Event".
    - Confirm the deletion prompt.
    - The event and all its registrations are deleted. The list returns to empty state.

12. **In-Memory Reset Verification**
    - Restart the backend server.
    - Refresh the browser. State is cleanly reset, verifying in-memory storage behavior.
