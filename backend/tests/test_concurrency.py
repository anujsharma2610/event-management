"""Concurrency tests demonstrating thread safety and race-condition resistance."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier

from app.errors import AlreadyRegisteredError, EventFullError
from app.schemas import EventCreate, RegisterRequest
from app.service import EventService
from app.store import EventStore


def test_concurrent_final_seat_contention(store: EventStore, fixed_now: datetime) -> None:
    """Verify that multiple concurrent threads competing for the last seat do not overbook.

    A barrier synchronizes 20 threads before they attempt to register distinct users
    for an event with capacity 1. Exactly 1 must succeed and 19 must receive EventFullError.
    """
    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Single Seat Event",
            description="Only 1 seat available",
            date=fixed_now + timedelta(days=5),
            maxCapacity=1,
        )
    )

    thread_count = 20
    barrier = Barrier(thread_count)
    successes: list[str] = []
    failures: list[Exception] = []

    def attempt_registration(user_id: str) -> None:
        try:
            # Synchronize all threads so they launch the critical section simultaneously
            barrier.wait(timeout=5.0)
            service.register(event.id, RegisterRequest(userId=user_id))
            successes.append(user_id)
        except Exception as exc:
            failures.append(exc)

    with ThreadPoolExecutor(max_workers=thread_count) as executor:
        futures = [
            executor.submit(attempt_registration, f"contender_{i}") for i in range(thread_count)
        ]
        for f in futures:
            f.result()

    # Proof: Exactly one thread succeeded
    assert len(successes) == 1

    # Proof: All 19 other threads failed specifically with EventFullError
    assert len(failures) == thread_count - 1
    assert all(isinstance(err, EventFullError) for err in failures)

    # Proof: Final state reflects exactly 1 attendee and 0 remaining capacity
    final_event = service.get_event(event.id)
    assert final_event.registration_count == 1
    assert final_event.remaining_capacity == 0
    assert final_event.status == "full"


def test_concurrent_duplicate_user_contention(store: EventStore, fixed_now: datetime) -> None:
    """Verify that concurrent attempts to register the same user result in exactly one registration.

    A barrier synchronizes 20 threads competing to register the exact same userId.
    Exactly 1 must succeed and 19 must receive AlreadyRegisteredError.
    """
    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Duplicate Contention Event",
            description="Capacity is plenty",
            date=fixed_now + timedelta(days=5),
            maxCapacity=50,
        )
    )

    thread_count = 20
    barrier = Barrier(thread_count)
    successes: list[str] = []
    failures: list[Exception] = []
    same_user_id = "same_attendee"

    def attempt_registration() -> None:
        try:
            barrier.wait(timeout=5.0)
            service.register(event.id, RegisterRequest(userId=same_user_id))
            successes.append(same_user_id)
        except Exception as exc:
            failures.append(exc)

    with ThreadPoolExecutor(max_workers=thread_count) as executor:
        futures = [executor.submit(attempt_registration) for _ in range(thread_count)]
        for f in futures:
            f.result()

    # Proof: Exactly one registration succeeded
    assert len(successes) == 1

    # Proof: All 19 other attempts failed specifically with AlreadyRegisteredError
    assert len(failures) == thread_count - 1
    assert all(isinstance(err, AlreadyRegisteredError) for err in failures)

    # Proof: Final state reflects exactly 1 attendee
    final_event = service.get_event(event.id)
    assert final_event.registration_count == 1
    assert final_event.remaining_capacity == 49
