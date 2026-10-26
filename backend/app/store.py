"""In-memory event and registration storage protected by a threading lock."""

import threading
from uuid import UUID

from app.models import EventRecord, RegistrationRecord


class EventStore:
    """In-memory store holding event and registration state with thread synchronization."""

    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.events: dict[UUID, EventRecord] = {}
        self.registrations: dict[UUID, dict[str, RegistrationRecord]] = {}
