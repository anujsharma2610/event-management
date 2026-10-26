"""Tests for health endpoint and application factory isolation."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_health_check(client: TestClient) -> None:
    """Verify /health returns 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_factory_creates_distinct_stores() -> None:
    """Verify that calling create_app without arguments creates isolated stores."""
    app1 = create_app()
    app2 = create_app()

    assert app1.state.store is not app2.state.store
    assert app1.state.store.events is not app2.state.store.events
    assert app1.state.store.registrations is not app2.state.store.registrations
