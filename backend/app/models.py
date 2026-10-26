"""Domain entity models stored in memory."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class RegistrationRecord:
    """Immutable representation of an attendee registration."""

    user_id: str
    registered_at: datetime


@dataclass(frozen=True)
class EventRecord:
    """Immutable representation of an event stored in memory."""

    id: UUID
    title: str
    description: str
    date: datetime
    max_capacity: int
    created_at: datetime
    updated_at: datetime
