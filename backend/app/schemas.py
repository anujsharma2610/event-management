"""Pydantic v2 schemas and validation models for Event Management API."""

import re
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

USER_ID_REGEX = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


class EventWrite(BaseModel):
    """Base schema for creating and updating events."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
    )

    title: str = Field(..., max_length=120)
    description: str = Field(..., max_length=2000)
    date: datetime
    max_capacity: int = Field(..., alias="maxCapacity", strict=True, ge=1, le=10000)

    @field_validator("title", mode="before")
    @classmethod
    def validate_and_trim_title(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Title must be a string.")
        trimmed = v.strip()
        if len(trimmed) < 1:
            raise ValueError("Title cannot be empty or whitespace only.")
        if len(trimmed) > 120:
            raise ValueError("Title cannot exceed 120 characters.")
        return trimmed

    @field_validator("description", mode="before")
    @classmethod
    def validate_description(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("Description must be a string.")
        if len(v) > 2000:
            raise ValueError("Description cannot exceed 2000 characters.")
        return v

    @field_validator("date", mode="before")
    @classmethod
    def validate_and_normalize_date(cls, v: Any) -> datetime:
        if isinstance(v, bool):
            raise ValueError("Date cannot be a boolean.")
        if isinstance(v, (int, float)):
            raise ValueError(
                "Numeric timestamps are not accepted; date must be an ISO 8601 string."
            )
        if isinstance(v, datetime):
            dt = v
        elif isinstance(v, str):
            # Parse ISO 8601 string
            try:
                # Replace trailing 'Z' with '+00:00' if fromisoformat needs it, though 3.11+ handles Z
                clean_v = v.replace("Z", "+00:00")
                dt = datetime.fromisoformat(clean_v)
            except Exception as e:
                raise ValueError(f"Invalid ISO 8601 datetime format: {e}") from e
        else:
            raise ValueError("Date must be an ISO 8601 string with a timezone offset.")

        if dt.tzinfo is None or dt.tzinfo.utcoffset(dt) is None:
            raise ValueError("Date must include a timezone offset (e.g. 'Z' or '+00:00').")

        return dt.astimezone(UTC)


class EventCreate(EventWrite):
    """Schema for event creation."""

    pass


class EventUpdate(EventWrite):
    """Schema for full event update (PUT). All fields required."""

    pass


class EventResponse(BaseModel):
    """Public representation of an event with derived metrics."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    id: UUID
    title: str
    description: str
    date: datetime
    max_capacity: int = Field(alias="maxCapacity")
    registration_count: int = Field(alias="registrationCount")
    remaining_capacity: int = Field(alias="remainingCapacity")
    status: Literal["upcoming", "full", "past"]
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")


class EventListResponse(BaseModel):
    """Collection wrapper for events."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    items: list[EventResponse]
    total: int


class RegisterRequest(BaseModel):
    """Request payload for registering an attendee."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
    )

    user_id: str = Field(..., alias="userId")

    @field_validator("user_id", mode="before")
    @classmethod
    def validate_and_trim_user_id(cls, v: Any) -> str:
        if not isinstance(v, str):
            raise ValueError("userId must be a string.")
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("userId cannot be empty or whitespace only.")
        if not USER_ID_REGEX.match(trimmed):
            raise ValueError(
                "userId must be 1-64 alphanumeric characters, underscores, or hyphens [A-Za-z0-9_-]."
            )
        return trimmed


class RegisterResponse(BaseModel):
    """Response payload upon successful attendee registration."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    event_id: UUID = Field(alias="eventId")
    user_id: str = Field(alias="userId")
    registered_at: datetime = Field(alias="registeredAt")


class RegistrationItem(BaseModel):
    """Representation of an attendee registration item."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    user_id: str = Field(alias="userId")
    registered_at: datetime = Field(alias="registeredAt")


class ListRegistrationsResponse(BaseModel):
    """Collection wrapper for event attendees."""

    model_config = ConfigDict(
        populate_by_name=True,
        serialize_by_alias=True,
    )

    event_id: UUID = Field(alias="eventId")
    items: list[RegistrationItem]
    total: int


class ErrorDetail(BaseModel):
    field: str | None = None
    message: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] = Field(default_factory=list)


class ErrorEnvelope(BaseModel):
    error: ErrorBody
