"""Domain exception classes and error contracts."""

from typing import Any


class AppError(Exception):
    """Base application error conforming to the standard API error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


class EventNotFoundError(AppError):
    def __init__(self, message: str = "Event not found.") -> None:
        super().__init__(
            code="EVENT_NOT_FOUND",
            message=message,
            status_code=404,
        )


class EventStartedError(AppError):
    def __init__(
        self,
        message: str = "Cannot register for an event that has already started or passed.",
    ) -> None:
        super().__init__(
            code="EVENT_STARTED",
            message=message,
            status_code=409,
        )


class AlreadyRegisteredError(AppError):
    def __init__(
        self,
        message: str = "User is already registered for this event.",
    ) -> None:
        super().__init__(
            code="ALREADY_REGISTERED",
            message=message,
            status_code=409,
        )


class EventFullError(AppError):
    def __init__(
        self,
        message: str = "This event has reached capacity.",
    ) -> None:
        super().__init__(
            code="EVENT_FULL",
            message=message,
            status_code=409,
        )


class CapacityBelowRegistrationsError(AppError):
    def __init__(
        self,
        message: str = "Capacity cannot be reduced below current registrations count.",
    ) -> None:
        super().__init__(
            code="CAPACITY_BELOW_REGISTRATIONS",
            message=message,
            status_code=409,
        )
