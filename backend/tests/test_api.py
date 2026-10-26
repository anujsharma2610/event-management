"""API contract and HTTP integration tests."""

from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def future_iso(fixed_now: datetime) -> str:
    """Return a future ISO datetime string with Z."""
    return (fixed_now + timedelta(days=7)).isoformat()


def test_create_event_endpoint(client: TestClient, future_iso: str) -> None:
    """Verify POST /api/events returns 201, Location header, and EventResponse."""
    payload = {
        "title": "API Launch Meetup",
        "description": "Celebrating our new REST API.",
        "date": future_iso,
        "maxCapacity": 25,
    }
    response = client.post("/api/events", json=payload)
    assert response.status_code == 201

    data = response.json()
    assert "id" in data
    assert data["title"] == "API Launch Meetup"
    assert data["maxCapacity"] == 25
    assert data["registrationCount"] == 0
    assert data["remainingCapacity"] == 25
    assert data["status"] == "upcoming"

    event_id = data["id"]
    assert response.headers["Location"] == f"/api/events/{event_id}"


def test_list_events_endpoint(client: TestClient, future_iso: str) -> None:
    """Verify GET /api/events returns collection wrapper."""
    client.post(
        "/api/events",
        json={"title": "E1", "description": "", "date": future_iso, "maxCapacity": 10},
    )
    client.post(
        "/api/events",
        json={"title": "E2", "description": "", "date": future_iso, "maxCapacity": 10},
    )

    response = client.get("/api/events")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 2
    assert len(data["items"]) == 2


def test_get_event_by_id(client: TestClient, future_iso: str) -> None:
    """Verify GET /api/events/{eventId} returns 200 for existing and 404 for missing."""
    create_res = client.post(
        "/api/events",
        json={"title": "Target Event", "description": "D", "date": future_iso, "maxCapacity": 15},
    )
    event_id = create_res.json()["id"]

    res = client.get(f"/api/events/{event_id}")
    assert res.status_code == 200
    assert res.json()["title"] == "Target Event"

    # Missing event returns 404 with standard envelope
    missing_id = str(uuid4())
    missing_res = client.get(f"/api/events/{missing_id}")
    assert missing_res.status_code == 404
    err = missing_res.json()
    assert err["error"]["code"] == "EVENT_NOT_FOUND"

    # Malformed UUID returns 422 with standard envelope
    bad_uuid_res = client.get("/api/events/not-a-valid-uuid")
    assert bad_uuid_res.status_code == 422
    assert bad_uuid_res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_put_event_endpoint(client: TestClient, future_iso: str) -> None:
    """Verify PUT /api/events/{eventId} replaces all writable fields."""
    create_res = client.post(
        "/api/events",
        json={
            "title": "Original",
            "description": "Original",
            "date": future_iso,
            "maxCapacity": 20,
        },
    )
    event_id = create_res.json()["id"]

    update_payload = {
        "title": "Updated Title",
        "description": "Updated Desc",
        "date": future_iso,
        "maxCapacity": 30,
    }
    put_res = client.put(f"/api/events/{event_id}", json=update_payload)
    assert put_res.status_code == 200
    data = put_res.json()
    assert data["title"] == "Updated Title"
    assert data["description"] == "Updated Desc"
    assert data["maxCapacity"] == 30


def test_delete_event_endpoint(client: TestClient, future_iso: str) -> None:
    """Verify DELETE /api/events/{eventId} returns 204 with empty body, and subsequent GET returns 404."""
    create_res = client.post(
        "/api/events",
        json={"title": "To Delete", "description": "", "date": future_iso, "maxCapacity": 10},
    )
    event_id = create_res.json()["id"]

    del_res = client.delete(f"/api/events/{event_id}")
    assert del_res.status_code == 204
    assert del_res.text == ""

    # Second delete returns 404
    del_again = client.delete(f"/api/events/{event_id}")
    assert del_again.status_code == 404
    assert del_again.json()["error"]["code"] == "EVENT_NOT_FOUND"


def test_registration_lifecycle(client: TestClient, future_iso: str) -> None:
    """Verify registration, listing registrations, conflict errors, and unregistration."""
    create_res = client.post(
        "/api/events",
        json={"title": "Workshop", "description": "", "date": future_iso, "maxCapacity": 1},
    )
    event_id = create_res.json()["id"]

    # 1. Register attendee-001 -> 201 with Location header
    reg_res = client.post(
        f"/api/events/{event_id}/registrations",
        json={"userId": "attendee-001"},
    )
    assert reg_res.status_code == 201
    assert reg_res.headers["Location"] == f"/api/events/{event_id}/registrations/attendee-001"
    assert reg_res.json()["userId"] == "attendee-001"

    # 2. Duplicate registration -> 409 ALREADY_REGISTERED
    dup_res = client.post(
        f"/api/events/{event_id}/registrations",
        json={"userId": "attendee-001"},
    )
    assert dup_res.status_code == 409
    assert dup_res.json()["error"]["code"] == "ALREADY_REGISTERED"

    # 3. Over-capacity registration -> 409 EVENT_FULL
    full_res = client.post(
        f"/api/events/{event_id}/registrations",
        json={"userId": "attendee-002"},
    )
    assert full_res.status_code == 409
    assert full_res.json()["error"]["code"] == "EVENT_FULL"

    # 4. List registrations -> 200 with 1 attendee
    list_res = client.get(f"/api/events/{event_id}/registrations")
    assert list_res.status_code == 200
    list_data = list_res.json()
    assert list_data["total"] == 1
    assert list_data["items"][0]["userId"] == "attendee-001"

    # 5. Unregister attendee-001 -> 204 empty
    unreg_res = client.delete(f"/api/events/{event_id}/registrations/attendee-001")
    assert unreg_res.status_code == 204
    assert unreg_res.text == ""

    # 6. Unregister absent user -> 204 empty (idempotent when event exists)
    absent_unreg = client.delete(f"/api/events/{event_id}/registrations/attendee-001")
    assert absent_unreg.status_code == 204
    assert absent_unreg.text == ""

    # 7. Unregister from missing event -> 404 EVENT_NOT_FOUND
    missing_unreg = client.delete(f"/api/events/{uuid4()}/registrations/attendee-001")
    assert missing_unreg.status_code == 404
    assert missing_unreg.json()["error"]["code"] == "EVENT_NOT_FOUND"


def test_malformed_json_handling(client: TestClient) -> None:
    """Verify malformed JSON payload returns 400 with INVALID_JSON error code."""
    res = client.post(
        "/api/events",
        content="{ bad json",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 400
    data = res.json()
    assert data["error"]["code"] == "INVALID_JSON"
    assert "details" in data["error"]


def test_cors_preflight(client: TestClient) -> None:
    """Verify CORS preflight OPTIONS request returns appropriate headers."""
    response = client.options(
        "/api/events",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"
