"""Unit tests for EventService business logic."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.errors import (
    AlreadyRegisteredError,
    CapacityBelowRegistrationsError,
    EventFullError,
    EventNotFoundError,
    EventStartedError,
)
from app.models import RegistrationRecord
from app.schemas import EventCreate, EventUpdate, RegisterRequest
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


def test_register_success(service: EventService, fixed_now: datetime) -> None:
    """Verify successful registration updates attendee count and capacity."""
    e = service.create_event(
        EventCreate(
            title="Register Event",
            description="",
            date=fixed_now + timedelta(days=2),
            maxCapacity=2,
        )
    )

    reg = service.register(e.id, RegisterRequest(userId="  attendee-001  "))
    assert reg.event_id == e.id
    assert reg.user_id == "attendee-001"  # trimmed
    assert reg.registered_at == fixed_now

    updated = service.get_event(e.id)
    assert updated.registration_count == 1
    assert updated.remaining_capacity == 1
    assert updated.status == "upcoming"


def test_register_past_or_equal_time_rejection(service: EventService, fixed_now: datetime) -> None:
    """Verify registration is rejected when event date <= now."""
    past_e = service.create_event(
        EventCreate(
            title="Past",
            description="",
            date=fixed_now - timedelta(hours=1),
            maxCapacity=10,
        )
    )
    with pytest.raises(EventStartedError):
        service.register(past_e.id, RegisterRequest(userId="user1"))

    equal_e = service.create_event(
        EventCreate(
            title="Equal",
            description="",
            date=fixed_now,
            maxCapacity=10,
        )
    )
    with pytest.raises(EventStartedError):
        service.register(equal_e.id, RegisterRequest(userId="user1"))


def test_register_duplicate_rejection(service: EventService, fixed_now: datetime) -> None:
    """Verify same user cannot register twice for same event, but can register for different events."""
    e1 = service.create_event(
        EventCreate(title="E1", description="", date=fixed_now + timedelta(days=1), maxCapacity=10)
    )
    e2 = service.create_event(
        EventCreate(title="E2", description="", date=fixed_now + timedelta(days=1), maxCapacity=10)
    )

    service.register(e1.id, RegisterRequest(userId="user-alpha"))

    # Same user on same event raises AlreadyRegisteredError
    with pytest.raises(AlreadyRegisteredError):
        service.register(e1.id, RegisterRequest(userId="user-alpha"))

    # Same user on different event succeeds
    reg2 = service.register(e2.id, RegisterRequest(userId="user-alpha"))
    assert reg2.event_id == e2.id
    assert reg2.user_id == "user-alpha"


def test_register_capacity_limit(service: EventService, fixed_now: datetime) -> None:
    """Verify registering past maxCapacity raises EventFullError."""
    e = service.create_event(
        EventCreate(
            title="Cap 2",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=2,
        )
    )

    service.register(e.id, RegisterRequest(userId="u1"))
    service.register(e.id, RegisterRequest(userId="u2"))

    event_full = service.get_event(e.id)
    assert event_full.registration_count == 2
    assert event_full.remaining_capacity == 0
    assert event_full.status == "full"

    with pytest.raises(EventFullError):
        service.register(e.id, RegisterRequest(userId="u3"))


def test_unregister_and_reregister(service: EventService, fixed_now: datetime) -> None:
    """Verify unregistering frees capacity and allows re-registration."""
    e = service.create_event(
        EventCreate(
            title="Unregister Test",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=1,
        )
    )

    service.register(e.id, RegisterRequest(userId="u1"))
    assert service.get_event(e.id).status == "full"

    service.unregister(e.id, "u1")
    assert service.get_event(e.id).registration_count == 0
    assert service.get_event(e.id).status == "upcoming"

    # Now u1 or another user can register
    service.register(e.id, RegisterRequest(userId="u1"))
    assert service.get_event(e.id).registration_count == 1


def test_unregister_allowed_when_past(service: EventService, fixed_now: datetime) -> None:
    """Verify unregistering is allowed even if the event has started or passed."""
    e = service.create_event(
        EventCreate(
            title="Past Allowed Unreg",
            description="",
            date=fixed_now + timedelta(hours=1),
            maxCapacity=10,
        )
    )
    service.register(e.id, RegisterRequest(userId="u1"))

    # Advance clock past event date
    service.clock = lambda: fixed_now + timedelta(hours=2)

    # Status is now past
    assert service.get_event(e.id).status == "past"

    # New registration rejected
    with pytest.raises(EventStartedError):
        service.register(e.id, RegisterRequest(userId="u2"))

    # Unregistration succeeds
    service.unregister(e.id, "u1")
    assert service.get_event(e.id).registration_count == 0


def test_unregister_absent_user_is_noop(service: EventService, fixed_now: datetime) -> None:
    """Verify unregistering an absent user raises no exception if event exists."""
    e = service.create_event(
        EventCreate(
            title="Noop Unreg",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    # Should not raise
    service.unregister(e.id, "non-existent-user")


def test_unregister_missing_event_raises_not_found(service: EventService) -> None:
    """Verify unregistering from a missing event raises EventNotFoundError."""
    with pytest.raises(EventNotFoundError):
        service.unregister(uuid4(), "user1")


def test_schema_validation_description() -> None:
    """VA05: Description length boundaries 0, 2000, 2001."""
    # 0 length
    e0 = EventCreate(title="T", description="", date="2030-06-15T12:00:00Z", maxCapacity=10)
    assert e0.description == ""

    # 2000 length
    e2k = EventCreate(
        title="T", description="x" * 2000, date="2030-06-15T12:00:00Z", maxCapacity=10
    )
    assert len(e2k.description) == 2000

    # 2001 length fails
    with pytest.raises(ValidationError):
        EventCreate(title="T", description="x" * 2001, date="2030-06-15T12:00:00Z", maxCapacity=10)


def test_register_whitespace_trimmed(service: EventService, fixed_now: datetime) -> None:
    """ID01: User ID is whitespace-trimmed upon registration."""
    e = service.create_event(
        EventCreate(
            title="Trim ID",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    res = service.register(e.id, RegisterRequest(userId="   attendee-trimmed   "))
    assert res.user_id == "attendee-trimmed"
    regs = service.list_registrations(e.id)
    assert regs.items[0].user_id == "attendee-trimmed"


def test_register_case_sensitive_identity(service: EventService, fixed_now: datetime) -> None:
    """ID02: User ID identities are case-sensitive."""
    e = service.create_event(
        EventCreate(
            title="Case Event",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    service.register(e.id, RegisterRequest(userId="UserAlpha"))
    service.register(e.id, RegisterRequest(userId="useralpha"))
    assert service.get_event(e.id).registration_count == 2


def test_register_user_id_length_boundaries(service: EventService, fixed_now: datetime) -> None:
    """ID04: User ID boundary validation (1 and 64 allowed, 0 and 65 rejected)."""
    e = service.create_event(
        EventCreate(
            title="Boundary Event",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    # 1 char allowed
    service.register(e.id, RegisterRequest(userId="A"))
    # 64 chars allowed
    id64 = "x" * 64
    service.register(e.id, RegisterRequest(userId=id64))

    # 65 chars rejected
    with pytest.raises(ValidationError):
        RegisterRequest(userId="x" * 65)

    # Empty rejected
    with pytest.raises(ValidationError):
        RegisterRequest(userId="")


def test_same_user_across_multiple_events(service: EventService, fixed_now: datetime) -> None:
    """ID05: Same user ID can register on multiple distinct events."""
    e1 = service.create_event(
        EventCreate(
            title="Event 1",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    e2 = service.create_event(
        EventCreate(
            title="Event 2",
            description="",
            date=fixed_now + timedelta(days=2),
            maxCapacity=10,
        )
    )
    service.register(e1.id, RegisterRequest(userId="common-user"))
    service.register(e2.id, RegisterRequest(userId="common-user"))

    assert service.get_event(e1.id).registration_count == 1
    assert service.get_event(e2.id).registration_count == 1


def test_register_unregister_normalization_parity(
    service: EventService, fixed_now: datetime
) -> None:
    """ID06: Registering with untrimmed and unregistering with trimmed works consistently."""
    e = service.create_event(
        EventCreate(
            title="Norm Event",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    service.register(e.id, RegisterRequest(userId="  user-to-remove  "))
    assert service.get_event(e.id).registration_count == 1

    service.unregister(e.id, "user-to-remove")
    assert service.get_event(e.id).registration_count == 0


def test_register_duplicate_precedence_over_full(
    service: EventService, fixed_now: datetime
) -> None:
    """RG03: Duplicate registration returns ALREADY_REGISTERED even if event is full."""
    from app.errors import AlreadyRegisteredError

    e = service.create_event(
        EventCreate(
            title="Tiny Event",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=1,
        )
    )
    service.register(e.id, RegisterRequest(userId="first-user"))
    assert service.get_event(e.id).status == "full"

    # Registering first-user again raises AlreadyRegisteredError (not EventFullError)
    with pytest.raises(AlreadyRegisteredError):
        service.register(e.id, RegisterRequest(userId="first-user"))


def test_register_past_duplicate_precedence(service: EventService, fixed_now: datetime) -> None:
    """RG04: Duplicate registration on past event returns EVENT_STARTED."""
    e = service.create_event(
        EventCreate(
            title="Past Precedence",
            description="",
            date=fixed_now + timedelta(hours=1),
            maxCapacity=10,
        )
    )
    service.register(e.id, RegisterRequest(userId="u1"))

    # Advance clock past event
    service.clock = lambda: fixed_now + timedelta(hours=2)

    # Attempt duplicate registration on past event -> EVENT_STARTED takes precedence
    with pytest.raises(EventStartedError):
        service.register(e.id, RegisterRequest(userId="u1"))


def test_register_one_microsecond_before_start(service: EventService, fixed_now: datetime) -> None:
    """DT07: Registration succeeds 1 microsecond before start time."""
    event_time = fixed_now + timedelta(hours=1)
    e = service.create_event(
        EventCreate(
            title="Blink Event",
            description="",
            date=event_time,
            maxCapacity=10,
        )
    )
    # Clock at exactly 1 microsecond before
    service.clock = lambda: event_time - timedelta(microseconds=1)
    res = service.register(e.id, RegisterRequest(userId="just-in-time"))
    assert res.user_id == "just-in-time"


def test_update_event_capacity_equals_attendees(service: EventService, fixed_now: datetime) -> None:
    """CP01: Capacity can be reduced to exactly equal current attendee count."""
    e = service.create_event(
        EventCreate(
            title="Equal Cap",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=5,
        )
    )
    service.register(e.id, RegisterRequest(userId="u1"))
    service.register(e.id, RegisterRequest(userId="u2"))

    updated = service.update_event(
        e.id,
        EventUpdate(
            title="Equal Cap",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=2,
        ),
    )
    assert updated.max_capacity == 2
    assert updated.remaining_capacity == 0
    assert updated.status == "full"


def test_update_event_increase_capacity_reopens_full_event(
    service: EventService, fixed_now: datetime
) -> None:
    """CP03: Increasing capacity on a full event reopens status to upcoming."""
    e = service.create_event(
        EventCreate(
            title="Full Reopen",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=1,
        )
    )
    service.register(e.id, RegisterRequest(userId="u1"))
    assert service.get_event(e.id).status == "full"

    updated = service.update_event(
        e.id,
        EventUpdate(
            title="Full Reopen",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        ),
    )
    assert updated.status == "upcoming"
    assert updated.remaining_capacity == 9


def test_move_future_event_to_past(service: EventService, fixed_now: datetime) -> None:
    """TM01: Moving event date to the past preserves attendees and sets status to past."""
    e = service.create_event(
        EventCreate(
            title="Will Be Past",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )
    service.register(e.id, RegisterRequest(userId="u1"))

    updated = service.update_event(
        e.id,
        EventUpdate(
            title="Now Past",
            description="",
            date=fixed_now - timedelta(days=1),
            maxCapacity=10,
        ),
    )
    assert updated.status == "past"
    assert updated.registration_count == 1

    # New registration rejected
    with pytest.raises(EventStartedError):
        service.register(e.id, RegisterRequest(userId="u2"))

    # Existing attendee unregister allowed
    service.unregister(e.id, "u1")
    assert service.get_event(e.id).registration_count == 0


def test_move_past_event_to_future(service: EventService, fixed_now: datetime) -> None:
    """TM02: Moving past event to future reopens registration."""
    e = service.create_event(
        EventCreate(
            title="Postponed",
            description="",
            date=fixed_now - timedelta(days=1),
            maxCapacity=10,
        )
    )
    assert service.get_event(e.id).status == "past"

    updated = service.update_event(
        e.id,
        EventUpdate(
            title="Rescheduled",
            description="",
            date=fixed_now + timedelta(days=5),
            maxCapacity=10,
        ),
    )
    assert updated.status == "upcoming"

    # Registration now succeeds
    res = service.register(e.id, RegisterRequest(userId="new-attendee"))
    assert res.user_id == "new-attendee"


def test_clock_advance_recomputes_status_without_write(
    service: EventService, fixed_now: datetime
) -> None:
    """TM03: Status transitions from upcoming to past as clock advances without mutation."""
    event_date = fixed_now + timedelta(hours=2)
    e = service.create_event(
        EventCreate(
            title="Passive Clock",
            description="",
            date=event_date,
            maxCapacity=10,
        )
    )
    assert service.get_event(e.id).status == "upcoming"

    # Advance clock past event date
    service.clock = lambda: event_date + timedelta(seconds=1)
    assert service.get_event(e.id).status == "past"


def test_event_ordering_same_instant_uuid_tiebreak(
    service: EventService, fixed_now: datetime
) -> None:
    """EV03: Events on identical date are deterministically ordered by UUID ascending."""
    same_date = fixed_now + timedelta(days=5)
    e1 = service.create_event(
        EventCreate(title="E1", description="", date=same_date, maxCapacity=10)
    )
    e2 = service.create_event(
        EventCreate(title="E2", description="", date=same_date, maxCapacity=10)
    )

    events = service.list_events().items
    # Find e1 and e2 in listing
    matched = [e for e in events if e.id in (e1.id, e2.id)]
    expected_order = sorted([e1, e2], key=lambda x: str(x.id))
    assert [e.id for e in matched] == [e.id for e in expected_order]
