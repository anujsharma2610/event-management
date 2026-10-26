"""Pytest configuration and common fixtures."""

from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import create_app
from app.store import EventStore


@pytest.fixture
def fixed_now() -> datetime:
    """Provide a fixed aware UTC datetime for predictable tests."""
    return datetime(2030, 6, 15, 12, 0, 0, tzinfo=UTC)


@pytest.fixture
def fake_clock(fixed_now: datetime) -> Callable[[], datetime]:
    """Provide a clock callable that returns a fixed datetime."""
    return lambda: fixed_now


@pytest.fixture
def store() -> EventStore:
    """Provide a fresh, isolated EventStore."""
    return EventStore()


@pytest.fixture
def app(store: EventStore, fake_clock: Callable[[], datetime]) -> FastAPI:
    """Provide a test application instance with injected store and clock."""
    return create_app(store=store, clock=fake_clock, seed_demo=False)


@pytest.fixture
def client(app: FastAPI) -> TestClient:
    """Provide a TestClient for testing HTTP endpoints."""
    return TestClient(app)
