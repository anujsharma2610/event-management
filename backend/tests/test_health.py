"""Tests for health endpoint and application factory isolation."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_check(client: TestClient) -> None:
    """Verify /health returns 200 with status ok."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_app_factory_creates_distinct_stores() -> None:
    """Verify that calling create_app without arguments creates isolated stores."""
    app1 = create_app(seed_demo=False)
    app2 = create_app(seed_demo=False)

    assert app1.state.store is not app2.state.store
    assert app1.state.store.events is not app2.state.store.events
    assert app1.state.store.registrations is not app2.state.store.registrations


def test_app_factory_seed_demo_data_isolation(monkeypatch: pytest.MonkeyPatch) -> None:
    """F04 / SYS02: SEED_DEMO_DATA=true in environment does not contaminate seed_demo=False apps."""
    monkeypatch.setenv("SEED_DEMO_DATA", "true")
    app = create_app(seed_demo=False)
    client = TestClient(app)
    res = client.get("/api/events")
    assert res.status_code == 200
    assert res.json()["total"] == 0


def test_app_factory_respects_explicit_seed_parameter() -> None:
    """F04: Explicit seed_demo parameter takes precedence over environment."""
    seeded_app = create_app(seed_demo=True)
    seeded_client = TestClient(seeded_app)
    res_seeded = seeded_client.get("/api/events")
    assert res_seeded.status_code == 200
    assert res_seeded.json()["total"] == 3

    unseeded_app = create_app(seed_demo=False)
    unseeded_client = TestClient(unseeded_app)
    res_unseeded = unseeded_client.get("/api/events")
    assert res_unseeded.status_code == 200
    assert res_unseeded.json()["total"] == 0
