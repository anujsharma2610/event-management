"""Event service providing thread-safe business logic operations."""

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Literal
from uuid import UUID, uuid4

from app.errors import (
    AlreadyRegisteredError,
    CapacityBelowRegistrationsError,
    EventFullError,
    EventNotFoundError,
    EventStartedError,
)
from app.models import EventRecord, RegistrationRecord
from app.schemas import (
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
    ListRegistrationsResponse,
    RegisterRequest,
    RegisterResponse,
    RegistrationItem,
)
from app.store import EventStore


class EventService:
    """Service layer coordinating business logic over the in-memory EventStore."""

    def __init__(
        self,
        store: EventStore,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.store = store
        self.clock = clock if clock is not None else (lambda: datetime.now(UTC))

    def _determine_status(
        self, event_date: datetime, now: datetime, registration_count: int, max_capacity: int
    ) -> Literal["upcoming", "full", "past"]:
        if event_date <= now:
            return "past"
        if registration_count >= max_capacity:
            return "full"
        return "upcoming"

    def _build_response(
        self, event: EventRecord, now: datetime, registration_count: int
    ) -> EventResponse:
        remaining = max(0, event.max_capacity - registration_count)
        status = self._determine_status(event.date, now, registration_count, event.max_capacity)
        return EventResponse(
            id=event.id,
            title=event.title,
            description=event.description,
            date=event.date,
            max_capacity=event.max_capacity,
            registration_count=registration_count,
            remaining_capacity=remaining,
            status=status,
            created_at=event.created_at,
            updated_at=event.updated_at,
        )

    def create_event(self, data: EventCreate) -> EventResponse:
        """Create a new event atomically."""
        with self.store.lock:
            now = self.clock()
            event_id = uuid4()
            record = EventRecord(
                id=event_id,
                title=data.title,
                description=data.description,
                date=data.date,
                max_capacity=data.max_capacity,
                created_at=now,
                updated_at=now,
            )
            self.store.events[event_id] = record
            self.store.registrations[event_id] = {}
            return self._build_response(record, now, 0)

    def list_events(self) -> EventListResponse:
        """List all events sorted by date ascending, then ID ascending."""
        with self.store.lock:
            now = self.clock()
            items: list[EventResponse] = []
            for event in self.store.events.values():
                count = len(self.store.registrations.get(event.id, {}))
                items.append(self._build_response(event, now, count))
            items.sort(key=lambda e: (e.date, e.id))
            return EventListResponse(items=items, total=len(items))

    def get_event(self, event_id: UUID) -> EventResponse:
        """Retrieve a single event by UUID."""
        with self.store.lock:
            if event_id not in self.store.events:
                raise EventNotFoundError()
            event = self.store.events[event_id]
            now = self.clock()
            count = len(self.store.registrations.get(event_id, {}))
            return self._build_response(event, now, count)

    def update_event(self, event_id: UUID, data: EventUpdate) -> EventResponse:
        """Perform full update of an existing event."""
        with self.store.lock:
            if event_id not in self.store.events:
                raise EventNotFoundError()
            current_regs = self.store.registrations.get(event_id, {})
            current_count = len(current_regs)
            if data.max_capacity < current_count:
                raise CapacityBelowRegistrationsError(
                    f"Cannot reduce capacity to {data.max_capacity}; "
                    f"event currently has {current_count} registered attendees."
                )
            now = self.clock()
            old_record = self.store.events[event_id]
            updated_record = EventRecord(
                id=event_id,
                title=data.title,
                description=data.description,
                date=data.date,
                max_capacity=data.max_capacity,
                created_at=old_record.created_at,
                updated_at=now,
            )
            self.store.events[event_id] = updated_record
            return self._build_response(updated_record, now, current_count)

    def delete_event(self, event_id: UUID) -> None:
        """Delete an event and cascade deletion to all registrations."""
        with self.store.lock:
            if event_id not in self.store.events:
                raise EventNotFoundError()
            del self.store.events[event_id]
            self.store.registrations.pop(event_id, None)

    def list_registrations(self, event_id: UUID) -> ListRegistrationsResponse:
        """List attendees for an event, sorted by registration time then user ID."""
        with self.store.lock:
            if event_id not in self.store.events:
                raise EventNotFoundError()
            records = list(self.store.registrations.get(event_id, {}).values())
            records.sort(key=lambda r: (r.registered_at, r.user_id))
            items = [
                RegistrationItem(user_id=r.user_id, registered_at=r.registered_at) for r in records
            ]
            return ListRegistrationsResponse(event_id=event_id, items=items, total=len(items))

    def register(self, event_id: UUID, data: RegisterRequest) -> RegisterResponse:
        """Register an attendee atomically under lock."""
        with self.store.lock:
            if event_id not in self.store.events:
                raise EventNotFoundError()
            event = self.store.events[event_id]
            now = self.clock()

            # Rule 1: Cannot register for event at or past start instant
            if event.date <= now:
                raise EventStartedError(
                    "Cannot register for an event that has already started or passed."
                )

            # Rule 2: Cannot register duplicate user ID
            user_id = data.user_id
            event_regs = self.store.registrations[event_id]
            if user_id in event_regs:
                raise AlreadyRegisteredError(
                    f"User '{user_id}' is already registered for this event."
                )

            # Rule 3: Cannot exceed capacity
            if len(event_regs) >= event.max_capacity:
                raise EventFullError("This event has reached capacity.")

            reg = RegistrationRecord(user_id=user_id, registered_at=now)
            event_regs[user_id] = reg
            return RegisterResponse(event_id=event_id, user_id=user_id, registered_at=now)

    def unregister(self, event_id: UUID, user_id: str) -> None:
        """Unregister an attendee atomically. Safe and idempotent if user is absent."""
        with self.store.lock:
            if event_id not in self.store.events:
                raise EventNotFoundError()
            trimmed_id = user_id.strip()
            self.store.registrations[event_id].pop(trimmed_id, None)
