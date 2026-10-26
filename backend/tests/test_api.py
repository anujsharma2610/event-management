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


def test_create_event_extreme_offset_date_returns_422(client: TestClient) -> None:
    """F03: Extreme offset dates overflowing Python year range return 422 VALIDATION_ERROR."""
    for extreme_date in ["0001-01-01T00:00:00+01:00", "9999-12-31T23:59:59-01:00"]:
        res = client.post(
            "/api/events",
            json={
                "title": "Extreme Date Event",
                "description": "",
                "date": extreme_date,
                "maxCapacity": 10,
            },
        )
        assert res.status_code == 422
        data = res.json()
        assert data["error"]["code"] == "VALIDATION_ERROR"
        assert any(d["field"] == "date" for d in data["error"]["details"])


def test_put_event_extreme_offset_date_returns_422(client: TestClient, future_iso: str) -> None:
    """F03: PUT with extreme date returns 422 and preserves existing record untouched."""
    create_res = client.post(
        "/api/events",
        json={"title": "Orig", "description": "D", "date": future_iso, "maxCapacity": 10},
    )
    eid = create_res.json()["id"]

    res = client.put(
        f"/api/events/{eid}",
        json={
            "title": "Updated",
            "description": "D",
            "date": "0001-01-01T00:00:00+01:00",
            "maxCapacity": 10,
        },
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"

    # Verify store is unmodified
    check = client.get(f"/api/events/{eid}")
    assert check.status_code == 200
    assert check.json()["title"] == "Orig"


def test_unsupported_method_preserves_allow_header(client: TestClient) -> None:
    """F05: Unsupported HTTP method returns 405 with standard Allow header preserved."""
    res = client.patch("/api/events")
    assert res.status_code == 405
    data = res.json()
    assert data["error"]["code"] == "HTTP_405"
    assert "Allow" in res.headers
    allowed = res.headers["Allow"]
    assert "GET" in allowed


def test_openapi_documents_malformed_json_on_all_body_routes(client: TestClient) -> None:
    """F06: Generated OpenAPI documents 400 on all body-accepting routes and user ID constraints."""
    spec = client.get("/openapi.json").json()
    paths = spec["paths"]

    # Check 400 on POST /api/events
    assert "400" in paths["/api/events"]["post"]["responses"]

    # Check 400 on PUT /api/events/{event_id}
    assert "400" in paths["/api/events/{event_id}"]["put"]["responses"]

    # Check 400 on POST /api/events/{event_id}/registrations
    assert "400" in paths["/api/events/{event_id}/registrations"]["post"]["responses"]

    # Check RegisterRequest schema has pattern and bounds
    reg_schema = spec["components"]["schemas"]["RegisterRequest"]
    assert "userId" in reg_schema["properties"]
    prop = reg_schema["properties"]["userId"]
    assert prop.get("minLength") == 1
    assert prop.get("maxLength") == 64
    assert prop.get("pattern") == "^[A-Za-z0-9_-]+$"


def test_unexpected_500_error_retains_cors_headers_for_allowed_origin(
    app: TestClient, client: TestClient
) -> None:
    """F12: Forced 500 error retains CORS headers for allowed origins and omits for disallowed."""
    from fastapi import Request

    # Create isolated client with test endpoint raising runtime exception
    from app.main import create_app

    test_app = create_app(seed_demo=False)

    @test_app.get("/api/test-forced-crash")
    def crash_endpoint(request: Request) -> None:
        raise RuntimeError("Simulated crash")

    crash_client = TestClient(test_app, raise_server_exceptions=False)

    # Allowed origin
    res_allowed = crash_client.get(
        "/api/test-forced-crash", headers={"Origin": "http://127.0.0.1:5173"}
    )
    assert res_allowed.status_code == 500
    assert res_allowed.json()["error"]["code"] == "INTERNAL_ERROR"
    assert res_allowed.headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"

    # Disallowed origin
    res_disallowed = crash_client.get(
        "/api/test-forced-crash", headers={"Origin": "https://unauthorized.domain"}
    )
    assert res_disallowed.status_code == 500
    assert "access-control-allow-origin" not in res_disallowed.headers


def test_create_event_unicode_title(client: TestClient, future_iso: str) -> None:
    """VA03: Unicode characters and emojis in event title are supported."""
    res = client.post(
        "/api/events",
        json={
            "title": "Tech Summit 🚀 世界",
            "description": "Unicode test",
            "date": future_iso,
            "maxCapacity": 50,
        },
    )
    assert res.status_code == 201
    assert res.json()["title"] == "Tech Summit 🚀 世界"


def test_create_event_missing_fields(client: TestClient) -> None:
    """VA07: Missing required fields return 422 with field-level details."""
    res = client.post("/api/events", json={})
    assert res.status_code == 422
    data = res.json()
    assert data["error"]["code"] == "VALIDATION_ERROR"
    fields = [d["field"] for d in data["error"]["details"]]
    assert "title" in fields
    assert "date" in fields
    assert "maxCapacity" in fields


def test_non_object_json_body_returns_422(client: TestClient) -> None:
    """ER04: Top-level non-object JSON bodies return 422 validation failure."""
    res = client.post(
        "/api/events",
        content="[1, 2, 3]",
        headers={"Content-Type": "application/json"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_malformed_uuid_returns_422(client: TestClient) -> None:
    """ER02: Malformed UUID path parameter returns 422 validation error."""
    res = client.get("/api/events/not-a-valid-uuid")
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_unknown_route_returns_404_envelope(client: TestClient) -> None:
    """ER05: Unknown route returns standard 404 NOT_FOUND envelope."""
    res = client.get("/api/non-existent-route")
    assert res.status_code == 404
    data = res.json()
    assert data["error"]["code"] == "NOT_FOUND"
