"""Optional startup demo data seeding with relative dates."""

from datetime import timedelta

from app.schemas import EventCreate, RegisterRequest
from app.service import EventService


def seed_demo_data(service: EventService) -> None:
    """Seed sample events and attendees using startup-relative dates."""
    now = service.clock()

    # 1. Upcoming available event
    e1 = service.create_event(
        EventCreate(
            title="Tech Summit 2030",
            description="Annual gathering of software architects and engineers.",
            date=now + timedelta(days=14),
            maxCapacity=100,
        )
    )
    service.register(e1.id, RegisterRequest(userId="attendee-001"))
    service.register(e1.id, RegisterRequest(userId="attendee-002"))

    # 2. Upcoming full event
    e2 = service.create_event(
        EventCreate(
            title="Exclusive Hands-on Workshop",
            description="Intensive masterclass on high-throughput systems.",
            date=now + timedelta(days=7),
            maxCapacity=2,
        )
    )
    service.register(e2.id, RegisterRequest(userId="attendee-001"))
    service.register(e2.id, RegisterRequest(userId="attendee-003"))

    # 3. Past event
    service.create_event(
        EventCreate(
            title="Previous Year Retrospective",
            description="Archived session reviewing past achievements.",
            date=now - timedelta(days=30),
            maxCapacity=50,
        )
    )
