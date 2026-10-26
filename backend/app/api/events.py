"""REST API routes for event management and attendee registrations."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Request, Response

from app.schemas import (
    ErrorEnvelope,
    EventCreate,
    EventListResponse,
    EventResponse,
    EventUpdate,
    ListRegistrationsResponse,
    RegisterRequest,
    RegisterResponse,
)
from app.service import EventService
from app.store import EventStore


def get_service(request: Request) -> EventService:
    """Dependency injection provider for EventService using app state."""
    store: EventStore = request.app.state.store
    clock = request.app.state.clock
    return EventService(store=store, clock=clock)


ServiceDep = Annotated[EventService, Depends(get_service)]

router = APIRouter(prefix="/api/events", tags=["Events"])


@router.get(
    "",
    response_model=EventListResponse,
    summary="List all events",
    description="Retrieve all events sorted by date ascending, then ID ascending.",
    responses={500: {"model": ErrorEnvelope}},
)
def list_events(service: ServiceDep) -> EventListResponse:
    return service.list_events()


@router.post(
    "",
    response_model=EventResponse,
    status_code=201,
    summary="Create a new event",
    description="Create an event with title, description, ISO date with timezone, and maxCapacity.",
    responses={
        400: {"model": ErrorEnvelope, "description": "Malformed JSON payload"},
        422: {"model": ErrorEnvelope, "description": "Validation failure"},
    },
)
def create_event(
    data: EventCreate,
    response: Response,
    service: ServiceDep,
) -> EventResponse:
    created = service.create_event(data)
    response.headers["Location"] = f"/api/events/{created.id}"
    return created


@router.get(
    "/{event_id}",
    response_model=EventResponse,
    summary="Get an event by ID",
    description="Retrieve event details including registration count and status.",
    responses={
        404: {"model": ErrorEnvelope, "description": "Event not found"},
        422: {"model": ErrorEnvelope, "description": "Invalid UUID parameter"},
    },
)
def get_event(
    event_id: UUID,
    service: ServiceDep,
) -> EventResponse:
    return service.get_event(event_id)


@router.put(
    "/{event_id}",
    response_model=EventResponse,
    summary="Update an existing event",
    description="Replace all writable fields of an existing event.",
    responses={
        400: {"model": ErrorEnvelope, "description": "Malformed JSON payload"},
        404: {"model": ErrorEnvelope, "description": "Event not found"},
        409: {"model": ErrorEnvelope, "description": "Capacity below registered attendee count"},
        422: {"model": ErrorEnvelope, "description": "Validation failure"},
    },
)
def update_event(
    event_id: UUID,
    data: EventUpdate,
    service: ServiceDep,
) -> EventResponse:
    return service.update_event(event_id, data)


@router.delete(
    "/{event_id}",
    status_code=204,
    response_class=Response,
    summary="Delete an event",
    description="Delete an event and cascade deletion to all associated registrations.",
    responses={
        204: {"description": "Event deleted successfully"},
        404: {"model": ErrorEnvelope, "description": "Event not found"},
        422: {"model": ErrorEnvelope, "description": "Invalid UUID parameter"},
    },
)
def delete_event(
    event_id: UUID,
    service: ServiceDep,
) -> Response:
    service.delete_event(event_id)
    return Response(status_code=204)


@router.get(
    "/{event_id}/registrations",
    response_model=ListRegistrationsResponse,
    summary="List attendees for an event",
    description="List all attendees registered for the specified event.",
    responses={
        404: {"model": ErrorEnvelope, "description": "Event not found"},
        422: {"model": ErrorEnvelope, "description": "Invalid UUID parameter"},
    },
)
def list_registrations(
    event_id: UUID,
    service: ServiceDep,
) -> ListRegistrationsResponse:
    return service.list_registrations(event_id)


@router.post(
    "/{event_id}/registrations",
    response_model=RegisterResponse,
    status_code=201,
    summary="Register attendee for an event",
    description="Register a user by userId. Enforces event date, duplicate, and capacity rules.",
    responses={
        400: {"model": ErrorEnvelope, "description": "Malformed JSON payload"},
        404: {"model": ErrorEnvelope, "description": "Event not found"},
        409: {"model": ErrorEnvelope, "description": "Event started, duplicate, or capacity full"},
        422: {"model": ErrorEnvelope, "description": "Validation failure"},
    },
)
def register_attendee(
    event_id: UUID,
    data: RegisterRequest,
    response: Response,
    service: ServiceDep,
) -> RegisterResponse:
    registered = service.register(event_id, data)
    response.headers["Location"] = f"/api/events/{event_id}/registrations/{registered.user_id}"
    return registered


@router.delete(
    "/{event_id}/registrations/{user_id}",
    status_code=204,
    response_class=Response,
    summary="Unregister attendee from an event",
    description="Unregister a user by userId. Returns 204 even if the user was not registered.",
    responses={
        204: {"description": "Attendee unregistered successfully or was not present"},
        404: {"model": ErrorEnvelope, "description": "Event not found"},
        422: {"model": ErrorEnvelope, "description": "Invalid event ID or user ID format"},
    },
)
def unregister_attendee(
    event_id: UUID,
    user_id: Annotated[str, Path(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")],
    service: ServiceDep,
) -> Response:
    service.unregister(event_id, user_id)
    return Response(status_code=204)
