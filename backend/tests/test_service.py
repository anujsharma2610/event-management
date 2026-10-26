"""Unit tests for EventService business logic."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.errors import (
    CapacityBelowRegistrationsError,
    EventNotFoundError,
)
from app.models import RegistrationRecord
from app.schemas import EventCreate, EventUpdate
from app.service import EventService
from app.store import EventStore


@pytest.fixture
def service(store: EventStore, fake_clock: callable) -> EventService:
    """Provide an EventService with injected store and fake clock."""
    return EventService(store=store, clock=fake_clock)


def test_create_event_success(service: EventService, fixed_now: datetime) -> None:
    """Verify event creation sets fields, calculates status, and persists in store."""
    event_date = fixed_now + timedelta(days=5)
    data = EventCreate(
        title="  Cloud Architecture Conference  ",
        description="A premier cloud conference.",
        date=event_date,
        maxCapacity=50,
    )

    created = service.create_event(data)

    assert created.id is not None
    assert created.title == "Cloud Architecture Conference"  # trimmed
    assert created.description == "A premier cloud conference."
    assert created.date == event_date
    assert created.max_capacity == 50
    assert created.registration_count == 0
    assert created.remaining_capacity == 50
    assert created.status == "upcoming"
    assert created.created_at == fixed_now
    assert created.updated_at == fixed_now


def test_list_events_deterministic_order(service: EventService, fixed_now: datetime) -> None:
    """Verify events are sorted by date ascending, then ID ascending."""
    d1 = fixed_now + timedelta(days=1)
    d2 = fixed_now + timedelta(days=2)

    e1 = service.create_event(EventCreate(title="E1", description="", date=d2, maxCapacity=10))
    e2 = service.create_event(EventCreate(title="E2", description="", date=d1, maxCapacity=10))

    events = service.list_events()
    assert events.total == 2
    assert events.items[0].id == e2.id
    assert events.items[1].id == e1.id


def test_get_event_success(service: EventService, fixed_now: datetime) -> None:
    """Verify retrieval of an existing event."""
    e = service.create_event(
        EventCreate(
            title="Single Event",
            description="Detail",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    fetched = service.get_event(e.id)
    assert fetched.id == e.id
    assert fetched.title == "Single Event"


def test_get_event_not_found(service: EventService) -> None:
    """Verify requesting a non-existent event raises EventNotFoundError."""
    with pytest.raises(EventNotFoundError):
        service.get_event(uuid4())


def test_update_event_success(service: EventService, fixed_now: datetime) -> None:
    """Verify full update of an event."""
    e = service.create_event(
        EventCreate(
            title="Old Title",
            description="Old Desc",
            date=fixed_now + timedelta(days=1),
            maxCapacity=20,
        )
    )

    new_date = fixed_now + timedelta(days=3)
    updated = service.update_event(
        e.id,
        EventUpdate(
            title="New Title",
            description="New Desc",
            date=new_date,
            maxCapacity=25,
        ),
    )

    assert updated.title == "New Title"
    assert updated.description == "New Desc"
    assert updated.date == new_date
    assert updated.max_capacity == 25
    assert updated.updated_at == fixed_now


def test_update_event_not_found(service: EventService, fixed_now: datetime) -> None:
    """Verify updating a non-existent event raises EventNotFoundError."""
    with pytest.raises(EventNotFoundError):
        service.update_event(
            uuid4(),
            EventUpdate(
                title="T",
                description="D",
                date=fixed_now + timedelta(days=1),
                maxCapacity=10,
            ),
        )


def test_update_event_cannot_reduce_capacity_below_registrations(
    service: EventService, store: EventStore, fixed_now: datetime
) -> None:
    """Verify updating capacity below current registrations raises CAPACITY_BELOW_REGISTRATIONS."""
    e = service.create_event(
        EventCreate(
            title="Event with attendees",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )

    # Manually insert 3 registrations into store
    with store.lock:
        store.registrations[e.id]["user1"] = RegistrationRecord("user1", fixed_now)
        store.registrations[e.id]["user2"] = RegistrationRecord("user2", fixed_now)
        store.registrations[e.id]["user3"] = RegistrationRecord("user3", fixed_now)

    # Reducing to 2 must fail
    with pytest.raises(CapacityBelowRegistrationsError):
        service.update_event(
            e.id,
            EventUpdate(
                title="Event with attendees",
                description="",
                date=fixed_now + timedelta(days=1),
                maxCapacity=2,
            ),
        )

    # Reducing to exactly 3 must succeed
    updated = service.update_event(
        e.id,
        EventUpdate(
            title="Event with attendees",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=3,
        ),
    )
    assert updated.max_capacity == 3
    assert updated.registration_count == 3
    assert updated.remaining_capacity == 0
    assert updated.status == "full"


def test_delete_event_clears_registrations(
    service: EventService, store: EventStore, fixed_now: datetime
) -> None:
    """Verify event deletion removes both event and registrations from store."""
    e = service.create_event(
        EventCreate(
            title="To Delete",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )

    with store.lock:
        store.registrations[e.id]["u1"] = RegistrationRecord("u1", fixed_now)

    service.delete_event(e.id)

    with store.lock:
        assert e.id not in store.events
        assert e.id not in store.registrations

    with pytest.raises(EventNotFoundError):
        service.get_event(e.id)


def test_delete_event_not_found(service: EventService) -> None:
    """Verify deleting a non-existent event raises EventNotFoundError."""
    with pytest.raises(EventNotFoundError):
        service.delete_event(uuid4())


def test_past_event_status(service: EventService, fixed_now: datetime) -> None:
    """Verify status is 'past' when event date <= current time."""
    past_date = fixed_now - timedelta(hours=1)
    e = service.create_event(
        EventCreate(
            title="Past Event",
            description="",
            date=past_date,
            maxCapacity=10,
        )
    )
    assert e.status == "past"

    equal_date = fixed_now
    e_equal = service.create_event(
        EventCreate(
            title="Now Event",
            description="",
            date=equal_date,
            maxCapacity=10,
        )
    )
    assert e_equal.status == "past"


def test_schema_validation_title() -> None:
    """Verify title validation and trimming."""
    # Whitespace only fails
    with pytest.raises(ValidationError):
        EventCreate(title="   ", description="desc", date="2030-06-15T12:00:00Z", maxCapacity=10)

    # Empty string fails
    with pytest.raises(ValidationError):
        EventCreate(title="", description="desc", date="2030-06-15T12:00:00Z", maxCapacity=10)

    # Title over 120 chars fails
    with pytest.raises(ValidationError):
        EventCreate(
            title="A" * 121, description="desc", date="2030-06-15T12:00:00Z", maxCapacity=10
        )


def test_schema_validation_capacity() -> None:
    """Verify capacity bounds and strict typing."""
    # Zero fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=0)

    # Negative fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=-5)

    # Over 10,000 fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=10001)

    # Boolean fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=True)

    # Float fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=10.5)

    # String number fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity="10")

    # Boundary 1 and 10000 succeed
    e1 = EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=1)
    e10k = EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=10000)
    assert e1.max_capacity == 1
    assert e10k.max_capacity == 10000


def test_schema_validation_date() -> None:
    """Verify date parsing requires timezone offset and rejects naive/numeric values."""
    # Naive date string rejected
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date="2030-06-15T12:00:00", maxCapacity=10)

    # Numeric timestamp rejected
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date=1750000000, maxCapacity=10)

    # Numeric float rejected
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="", date=1750000000.5, maxCapacity=10)

    # Non-UTC offset normalized to UTC
    # 2030-06-15T17:30:00+05:30 equals 2030-06-15T12:00:00 UTC
    e = EventCreate(title="T", description="", date="2030-06-15T17:30:00+05:30", maxCapacity=10)
    assert e.date.tzinfo == UTC
    assert e.date.hour == 12
    assert e.date.minute == 0


def test_schema_extra_fields_forbidden() -> None:
    """Verify unknown fields are rejected."""
    with pytest.raises(ValidationError):
        EventCreate(
            title="T",
            description="",
            date="2030-06-15T12:00:00Z",
            maxCapacity=10,
            unexpectedField="surprise",
        )
