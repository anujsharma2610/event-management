"""Concurrency tests demonstrating thread safety and race-condition resistance."""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from threading import Barrier
from typing import Any

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
            f.result(timeout=10.0)

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
            f.result(timeout=10.0)

    # Proof: Exactly one registration succeeded
    assert len(successes) == 1

    # Proof: All 19 other attempts failed specifically with AlreadyRegisteredError
    assert len(failures) == thread_count - 1
    assert all(isinstance(err, AlreadyRegisteredError) for err in failures)

    # Proof: Final state reflects exactly 1 attendee
    final_event = service.get_event(event.id)
    assert final_event.registration_count == 1
    assert final_event.remaining_capacity == 49


def test_concurrent_register_vs_capacity_reduction(store: EventStore, fixed_now: datetime) -> None:
    """CC03: Register racing capacity reduction resolves to a valid serial execution."""
    from app.errors import CapacityBelowRegistrationsError
    from app.schemas import EventUpdate

    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Cap Contention",
            description="",
            date=fixed_now + timedelta(days=5),
            maxCapacity=5,
        )
    )
    service.register(event.id, RegisterRequest(userId="user-1"))
    service.register(event.id, RegisterRequest(userId="user-2"))

    barrier = Barrier(2)
    reg_outcome: dict[str, Any] = {}
    put_outcome: dict[str, Any] = {}

    def attempt_register() -> None:
        try:
            barrier.wait(timeout=5.0)
            res = service.register(event.id, RegisterRequest(userId="user-3"))
            reg_outcome["success"] = res
        except Exception as exc:
            reg_outcome["error"] = exc

    def attempt_reduce_capacity() -> None:
        try:
            barrier.wait(timeout=5.0)
            res = service.update_event(
                event.id,
                EventUpdate(
                    title="Cap Contention",
                    description="",
                    date=fixed_now + timedelta(days=5),
                    maxCapacity=2,
                ),
            )
            put_outcome["success"] = res
        except Exception as exc:
            put_outcome["error"] = exc

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_register)
        f2 = executor.submit(attempt_reduce_capacity)
        f1.result(timeout=10.0)
        f2.result(timeout=10.0)

    final_event = service.get_event(event.id)
    # Allowed serial outcome 1: Register ran first -> PUT failed with CapacityBelowRegistrationsError
    if "success" in reg_outcome:
        assert isinstance(put_outcome.get("error"), CapacityBelowRegistrationsError)
        assert final_event.max_capacity == 5
        assert final_event.registration_count == 3
    # Allowed serial outcome 2: PUT ran first -> capacity became 2 (full) -> Register failed with EventFullError
    else:
        assert "success" in put_outcome
        assert isinstance(reg_outcome.get("error"), EventFullError)
        assert final_event.max_capacity == 2
        assert final_event.registration_count == 2

    # Invariant: registration_count <= max_capacity
    assert final_event.registration_count <= final_event.max_capacity


def test_concurrent_register_vs_delete(store: EventStore, fixed_now: datetime) -> None:
    """CC04: Register racing event deletion leaves zero orphan registrations and no unexpected error."""
    from app.errors import EventNotFoundError

    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Delete Contention",
            description="",
            date=fixed_now + timedelta(days=5),
            maxCapacity=10,
        )
    )

    barrier = Barrier(2)
    reg_outcome: dict[str, Any] = {}
    del_outcome: dict[str, Any] = {}

    def attempt_reg() -> None:
        try:
            barrier.wait(timeout=5.0)
            service.register(event.id, RegisterRequest(userId="racer"))
            reg_outcome["success"] = True
        except Exception as exc:
            reg_outcome["error"] = exc

    def attempt_del() -> None:
        try:
            barrier.wait(timeout=5.0)
            service.delete_event(event.id)
            del_outcome["success"] = True
        except Exception as exc:
            del_outcome["error"] = exc

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_reg)
        f2 = executor.submit(attempt_del)
        f1.result(timeout=10.0)
        f2.result(timeout=10.0)

    # Delete always succeeds
    assert del_outcome.get("success") is True

    # If reg ran before delete, it succeeded, then delete cleaned it up.
    # If reg ran after delete, it failed with EventNotFoundError.
    if "error" in reg_outcome:
        assert isinstance(reg_outcome["error"], EventNotFoundError)

    # Invariant: Event is deleted and store has 0 orphan registrations for this event
    assert event.id not in store.events
    assert event.id not in store.registrations


def test_concurrent_register_vs_unregister_same_user(
    store: EventStore, fixed_now: datetime
) -> None:
    """CC05: Register vs unregister for the same user resolves cleanly to a valid serial outcome."""
    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Toggle User",
            description="",
            date=fixed_now + timedelta(days=5),
            maxCapacity=10,
        )
    )
    # Start with user already registered
    service.register(event.id, RegisterRequest(userId="user-toggle"))

    barrier = Barrier(2)
    unreg_outcome: dict[str, Any] = {}
    reg_outcome: dict[str, Any] = {}

    def attempt_unreg() -> None:
        try:
            barrier.wait(timeout=5.0)
            service.unregister(event.id, "user-toggle")
            unreg_outcome["success"] = True
        except Exception as exc:
            unreg_outcome["error"] = exc

    def attempt_reg() -> None:
        try:
            barrier.wait(timeout=5.0)
            service.register(event.id, RegisterRequest(userId="user-toggle"))
            reg_outcome["success"] = True
        except Exception as exc:
            reg_outcome["error"] = exc

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_unreg)
        f2 = executor.submit(attempt_reg)
        f1.result(timeout=10.0)
        f2.result(timeout=10.0)

    # Unregister always succeeds (204)
    assert unreg_outcome.get("success") is True

    # Final state must be either user is registered (count 1) or unregistered (count 0)
    final_event = service.get_event(event.id)
    assert final_event.registration_count in (0, 1)


def test_concurrent_unregister_same_user(store: EventStore, fixed_now: datetime) -> None:
    """CC06: Concurrent unregister calls for the same user are idempotent and safe."""
    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Concurrent Unreg",
            description="",
            date=fixed_now + timedelta(days=5),
            maxCapacity=10,
        )
    )
    service.register(event.id, RegisterRequest(userId="target-user"))

    barrier = Barrier(2)
    errors: list[Exception] = []

    def unreg_thread() -> None:
        try:
            barrier.wait(timeout=5.0)
            service.unregister(event.id, "target-user")
        except Exception as exc:
            errors.append(exc)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(unreg_thread)
        f2 = executor.submit(unreg_thread)
        f1.result(timeout=10.0)
        f2.result(timeout=10.0)

    assert len(errors) == 0
    final_event = service.get_event(event.id)
    assert final_event.registration_count == 0


def test_concurrent_date_edit_vs_register(store: EventStore, fixed_now: datetime) -> None:
    """CC07: Date change to past racing with registration resolves to a valid serial outcome."""
    from app.errors import EventStartedError
    from app.schemas import EventUpdate

    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Time Shift Event",
            description="",
            date=fixed_now + timedelta(days=1),
            maxCapacity=10,
        )
    )

    barrier = Barrier(2)
    reg_outcome: dict[str, Any] = {}
    edit_outcome: dict[str, Any] = {}

    def attempt_reg() -> None:
        try:
            barrier.wait(timeout=5.0)
            res = service.register(event.id, RegisterRequest(userId="time-racer"))
            reg_outcome["success"] = res
        except Exception as exc:
            reg_outcome["error"] = exc

    def attempt_move_to_past() -> None:
        try:
            barrier.wait(timeout=5.0)
            res = service.update_event(
                event.id,
                EventUpdate(
                    title="Time Shift Event",
                    description="",
                    date=fixed_now - timedelta(days=1),
                    maxCapacity=10,
                ),
            )
            edit_outcome["success"] = res
        except Exception as exc:
            edit_outcome["error"] = exc

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(attempt_reg)
        f2 = executor.submit(attempt_move_to_past)
        f1.result(timeout=10.0)
        f2.result(timeout=10.0)

    assert "success" in edit_outcome
    # Either reg ran before date move (success) or after (EventStartedError)
    if "error" in reg_outcome:
        assert isinstance(reg_outcome["error"], EventStartedError)


def test_concurrent_reads_during_active_mutations(store: EventStore, fixed_now: datetime) -> None:
    """CC08: Continuous reads during active mutations observe valid capacity and count invariants."""
    service = EventService(store=store, clock=lambda: fixed_now)
    event = service.create_event(
        EventCreate(
            title="Read Invariant Event",
            description="",
            date=fixed_now + timedelta(days=5),
            maxCapacity=20,
        )
    )

    barrier = Barrier(10)
    invariants_held = True

    def writer(idx: int) -> None:
        barrier.wait(timeout=5.0)
        user_id = f"writer_user_{idx}"
        service.register(event.id, RegisterRequest(userId=user_id))
        service.unregister(event.id, user_id)

    def reader() -> None:
        nonlocal invariants_held
        barrier.wait(timeout=5.0)
        for _ in range(20):
            ev = service.get_event(event.id)
            if ev.registration_count + ev.remaining_capacity != ev.max_capacity:
                invariants_held = False
            if ev.registration_count > ev.max_capacity:
                invariants_held = False

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(writer, i) for i in range(5)]
        futures.extend([executor.submit(reader) for _ in range(5)])
        for f in futures:
            f.result(timeout=10.0)

    assert invariants_held is True


def test_register_lock_wait_across_start_time(store: EventStore, fixed_now: datetime) -> None:
    """DT08: Clock is evaluated inside the lock, preventing late registration if wait crosses start."""
    import time

    from app.errors import EventStartedError

    # Event starts at T + 0.1s
    event_start = fixed_now + timedelta(seconds=1)
    service = EventService(store=store, clock=lambda: current_time)
    current_time = fixed_now

    event = service.create_event(
        EventCreate(
            title="Lock Wait Event",
            description="",
            date=event_start,
            maxCapacity=10,
        )
    )

    barrier = Barrier(2)
    reg_error: list[Exception] = []

    def blocking_thread() -> None:
        nonlocal current_time
        with store.lock:
            # Synchronize so reg thread attempts to enter lock
            barrier.wait(timeout=5.0)
            # Advance time past event start while holding the lock
            current_time = event_start + timedelta(seconds=1)
            time.sleep(0.05)

    def reg_thread() -> None:
        try:
            barrier.wait(timeout=5.0)
            # Will wait until blocking_thread releases lock
            service.register(event.id, RegisterRequest(userId="late-comer"))
        except Exception as exc:
            reg_error.append(exc)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(blocking_thread)
        f2 = executor.submit(reg_thread)
        f1.result(timeout=10.0)
        f2.result(timeout=10.0)

    # Registration must fail with EventStartedError because clock was sampled inside lock
    assert len(reg_error) == 1
    assert isinstance(reg_error[0], EventStartedError)
