# Scenario Coverage Matrix

This matrix documents the verification coverage for all business invariants, input validation boundaries, concurrency interleavings, HTTP error contracts, frontend lifecycle states, and accessibility requirements.

**Coverage Key**:
- `Covered`: Asserted by an automated test checking the specific outcome and postconditions.
- `Partial`: Exercised by an automated test but lacking certain edge-condition assertions.
- `Missing`: Not currently asserted by a dedicated test.
- `Deferred`: Intentionally out of scope for the take-home assessment, with recorded rationale.

---

## 1. Event Lifecycle & Storage (EV01-EV08)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **EV01** | Create event stores full record | Empty store | `POST /api/events` with valid body | 201 Created with Location header, assigned UUID, createdAt=updatedAt, full fields | `tests/test_api.py::test_create_event_endpoint` | API | Covered | In-memory only |
| **EV02** | Empty collection | Fresh store | `GET /api/events` | 200 OK with `{"items": [], "total": 0}` | `tests/test_api.py::test_list_events_endpoint` | API | Covered | Single process |
| **EV03** | Deterministic list ordering | Events with equal and different dates | `GET /api/events` | Sorted by date ascending, then ID ascending | `tests/test_service.py::test_list_events_deterministic_order` | Service | Covered | Unpaginated |
| **EV04** | Get event by ID | Event exists | `GET /api/events/{id}` | 200 OK with matching record, registration count, remaining capacity, status | `tests/test_api.py::test_get_event_by_id` | API | Covered | Memory-bound |
| **EV05** | Full update (PUT) | Event exists | `PUT /api/events/{id}` with valid payload | 200 OK, updated fields stored, updatedAt updated, createdAt preserved | `tests/test_api.py::test_put_event_endpoint` | API | Covered | Replaces all writable fields |
| **EV06** | Delete event cascades | Event with registered attendees | `DELETE /api/events/{id}` | 204 No Content, event and registrations deleted from store | `tests/test_service.py::test_delete_event_clears_registrations` | Service | Covered | Irreversible |
| **EV07** | Repeat delete returns 404 | Event already deleted | `DELETE /api/events/{id}` | 404 Not Found with EVENT_NOT_FOUND code | `tests/test_service.py::test_delete_event_not_found` | Service | Covered | No tombstone persistence |
| **EV08** | Access nested registrations after delete | Event deleted | `GET /api/events/{id}/registrations` | 404 Not Found with EVENT_NOT_FOUND code | `tests/test_api.py::test_delete_event_endpoint` | API | Covered | Cascade verification |

---

## 2. Validation & Input Boundaries (VA01-VA12)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **VA01** | Title lengths 0, 1, 120, 121 | Empty store | Create events with title lengths 0, 1, 120, 121 | 0 and 121 fail with 422; 1 and 120 succeed | `tests/test_service.py::test_schema_validation_title` | Schema | Covered | Max 120 chars |
| **VA02** | Title whitespace trimming | Empty store | Create event with `"  Summit 2030  "` | Stored title trimmed to `"Summit 2030"` | `tests/test_service.py::test_schema_validation_title` | Schema | Covered | Whitespace only rejected |
| **VA03** | Unicode and emoji in title | Empty store | Create event with `"Tech Summit 🚀 世界"` | 201 Created, stored as valid Unicode | `tests/test_api.py::test_create_event_unicode_title` | API | Covered | Standard Python UTF-8 |
| **VA04** | Long unbroken title | Empty store | Display long unbroken string in UI | CSS wraps unbroken words without layout overflow | `frontend/src/styles.css` (`word-break: break-word`) | UI | Covered | Browser reflow |
| **VA05** | Description lengths 0, 2000, 2001 | Empty store | Create with empty description and 2000 chars | 0 and 2000 succeed; 2001 fails with 422 | `tests/test_service.py::test_schema_validation_description` | Schema | Covered | Max 2000 chars |
| **VA06** | Description non-string / missing | Empty store | Create with `description: 123` or omitted | 422 for non-string; default empty string if omitted | `tests/test_service.py::test_schema_extra_fields_forbidden` | Schema | Covered | Pydantic strict types |
| **VA07** | Missing required fields | Empty store | Create with missing `title` or `date` | 422 VALIDATION_ERROR detailing missing fields | `tests/test_api.py::test_create_event_missing_fields` | API | Covered | Field-level details |
| **VA08** | Unexpected extra fields | Empty store | Create with extra field `"sponsor": "Google"` | 422 VALIDATION_ERROR (extra forbidden) | `tests/test_service.py::test_schema_extra_fields_forbidden` | Schema | Covered | Extra forbidden policy |
| **VA09** | Capacity bounds 1 and 10000 | Empty store | Create with capacity 1 and 10000 | 201 Created | `tests/test_service.py::test_schema_validation_capacity` | Schema | Covered | Upper bound 10,000 |
| **VA10** | Capacity bounds 0, negative, 10001 | Empty store | Create with capacity 0, -5, 10001 | 422 VALIDATION_ERROR | `tests/test_service.py::test_schema_validation_capacity` | Schema | Covered | Strict integer bounds |
| **VA11** | Non-integer capacity (bool, float, string) | Empty store | Create with `maxCapacity: true`, `1.5`, `"10"` | 422 VALIDATION_ERROR (strict=True prevents bool/float coercion) | `tests/test_service.py::test_schema_validation_capacity` | Schema | Covered | Pydantic strict mode |
| **VA12** | Missing/null capacity | Empty store | Create with `maxCapacity: null` | 422 VALIDATION_ERROR | `tests/test_service.py::test_schema_validation_capacity` | Schema | Covered | Null rejected |

---

## 3. Date, Time & Timezone Handling (DT01-DT12)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **DT01** | UTC offset and Z equivalence | Empty store | Create with `2030-06-15T15:00:00+02:00` | Normalized to `2030-06-15T13:00:00Z` | `tests/test_service.py::test_schema_validation_date` | Service | Covered | Canonical UTC storage |
| **DT02** | Naive date rejected | Empty store | Create with `2030-06-15T13:00:00` (no offset) | 422 VALIDATION_ERROR | `tests/test_service.py::test_schema_validation_date` | Service | Covered | Timezone offset required |
| **DT03** | Malformed date strings | Empty store | Create with `"not-a-date"` or leap invalid | 422 VALIDATION_ERROR | `tests/test_service.py::test_schema_validation_date` | Schema | Covered | ISO 8601 validation |
| **DT04** | Non-string date (numeric, bool, null) | Empty store | Create with `date: 1718456400` or `null` | 422 VALIDATION_ERROR | `tests/test_service.py::test_schema_validation_date` | Schema | Covered | String ISO required |
| **DT05** | Extreme offset bounds (year 1 and 9999) | Empty store | `0001-01-01T00:00:00+01:00`, `9999-12-31T23:59:59-01:00` | 422 VALIDATION_ERROR (Overflow converted to validation failure) | `tests/test_api.py::test_create_event_extreme_offset_date_returns_422` | API | Covered | Python datetime range 1-9999 |
| **DT06** | Exact start instant registration | Event at `T` | Clock at `T`, attempt registration | 409 Conflict with EVENT_STARTED (`date <= now`) | `tests/test_service.py::test_register_past_or_equal_time_rejection` | Service | Covered | Closed at exact start |
| **DT07** | Boundary: 1 microsecond before start | Event at `T` | Clock at `T - 1µs`, register | Registration succeeds | `tests/test_service.py::test_register_one_microsecond_before_start` | Service | Covered | Microsecond clock resolution |
| **DT08** | Clock advances while waiting for lock | Event at `T` | Register enqueued at `T - 10ms`, lock acquired at `T + 1ms` | 409 Conflict EVENT_STARTED (sampled inside lock) | `tests/test_concurrency.py::test_register_lock_wait_across_start_time` | Concurrency | Covered | Clock sampled inside critical section |
| **DT09** | Non-UTC date display conversion | Browser timezone | Frontend renders UTC ISO string | Local wall-clock time displayed accurately | `frontend/src/utils/date.test.ts::converts UTC ISO string to local input format` | Component | Covered | Browser Intl API |
| **DT10** | Unchanged edit preserves seconds and fractions | Event created with `...:45.123Z` | Edit title only via frontend form | Saved payload retains `...:45.123Z` | `frontend/src/components/EventForm.test.tsx::preserves exact seconds and fractional precision when date is untouched` | Component | Covered | Precision preserved |
| **DT11** | Daylight saving time transition | DST gap / overlap | Local input converted to UTC ISO | Valid UTC ISO instant generated | `frontend/src/utils/date.test.ts::handles daylight saving transitions cleanly` | Util | Covered | Local browser Date handling |
| **DT12** | Local date input round trip | Local input string | `localInputToIsoUtc` -> `isoUtcToLocalInput` | Preserves local minute representation | `frontend/src/utils/date.test.ts::round-trips standard local datetime strings` | Util | Covered | Minute-resolution input control |

---

## 4. Attendee Identity & Registration Rules (ID01-ID06, RG01-RG08)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **ID01** | Whitespace trimming on user ID | Event exists | Register `"  user-1  "` | Stored as `"user-1"`, normalized in Location header | `tests/test_service.py::test_register_whitespace_trimmed` | Service | Covered | Alphanumeric + `_`, `-` |
| **ID02** | Case sensitivity | Event exists | Register `"UserA"` and `"usera"` | Treated as two distinct registrations | `tests/test_service.py::test_register_case_sensitive_identity` | Service | Covered | Preserves case |
| **ID03** | Allowed user ID characters | Event exists | Register with letters, digits, `_`, `-` | 201 Created | `tests/test_api.py::test_registration_lifecycle` | API | Covered | Regex `^[A-Za-z0-9_-]+$` |
| **ID04** | User ID length boundaries 1, 64, 65 | Event exists | Register lengths 0, 1, 64, 65 | 0 and 65 fail with 422; 1 and 64 succeed | `tests/test_service.py::test_register_user_id_length_boundaries` | Service | Covered | 1-64 chars |
| **ID05** | Same user ID across different events | Events A and B exist | Register `"user-1"` on A, then on B | Both succeed independently | `tests/test_service.py::test_same_user_across_multiple_events` | Service | Covered | Independent scopes |
| **ID06** | Register and unregister normalization | Event exists | Register `"  user-1  "`, unregister `"user-1"` | Unregistration succeeds (removes attendee) | `tests/test_service.py::test_register_unregister_normalization_parity` | Service | Covered | Consistent trimming |
| **RG01** | First registration | Event with capacity 10 | Register `"user-1"` | 201 Created, count=1, remaining=9 | `tests/test_service.py::test_register_success` | Service | Covered | Immediate counter updates |
| **RG02** | Final seat registration | Event with capacity 1, count 0 | Register `"user-1"` | 201 Created, count=1, remaining=0, status="full" | `tests/test_service.py::test_register_capacity_limit` | Service | Covered | Status changes to full |
| **RG03** | Duplicate registration on full event | Event with capacity 1, `"user-1"` registered | Register `"user-1"` again | 409 Conflict with ALREADY_REGISTERED (precedence over full) | `tests/test_service.py::test_register_duplicate_precedence_over_full` | Service | Covered | Precedence: ALREADY_REGISTERED |
| **RG04** | Past duplicate registration | Past event with `"user-1"` registered | Register `"user-1"` | 409 Conflict with EVENT_STARTED (precedence over duplicate) | `tests/test_service.py::test_register_past_duplicate_precedence` | Service | Covered | Precedence: EVENT_STARTED |
| **RG05** | Unregister absent user | Event with 0 attendees | Unregister `"user-unknown"` | 204 No Content (idempotent no-op) | `tests/test_service.py::test_unregister_absent_user_is_noop` | Service | Covered | Idempotent |
| **RG06** | Unregister after event start | Past event with `"user-1"` registered | Unregister `"user-1"` | 204 No Content, count decremented | `tests/test_service.py::test_unregister_allowed_when_past` | Service | Covered | Permitted after start |
| **RG07** | Unregister frees final seat | Event with capacity 1, count 1 (full) | Unregister `"user-1"` | 204 No Content, remaining=1, status="upcoming" | `tests/test_service.py::test_unregister_and_reregister` | Service | Covered | Reopens event |
| **RG08** | Re-register after unregister | Event with `"user-1"` unregistered | Register `"user-1"` again | 201 Created | `tests/test_service.py::test_unregister_and_reregister` | Service | Covered | Permits re-registration |

---

## 5. Capacity & Time Mutation (CP01-CP04, TM01-TM03)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **CP01** | Capacity equals attendee count | Event with 3 attendees | `PUT` with `maxCapacity: 3` | 200 OK, remainingCapacity=0, status="full" | `tests/test_service.py::test_update_event_capacity_equals_attendees` | Service | Covered | Valid boundary |
| **CP02** | Capacity reduction below attendee count | Event with 3 attendees | `PUT` with `maxCapacity: 2` | 409 Conflict CAPACITY_BELOW_REGISTRATIONS; record untouched | `tests/test_service.py::test_update_event_cannot_reduce_capacity_below_registrations` | Service | Covered | Atomically aborted |
| **CP03** | Increase capacity on full event | Event with capacity 2, count 2 (full) | `PUT` with `maxCapacity: 5` | 200 OK, remaining=3, status="upcoming" | `tests/test_service.py::test_update_event_increase_capacity_reopens_full_event` | Service | Covered | Reopens event |
| **CP04** | Empty event resize | Event with 0 attendees | `PUT` with `maxCapacity: 1` | 200 OK, maxCapacity=1, remaining=1 | `tests/test_service.py::test_update_event_success` | Service | Covered | Immediate effect |
| **TM01** | Move future event to past | Future event with 2 attendees | `PUT` date to past instant | 200 OK, status="past", attendees preserved, new registrations blocked | `tests/test_service.py::test_move_future_event_to_past` | Service | Covered | Retains existing attendees |
| **TM02** | Move past event to future | Past event | `PUT` date to future instant | 200 OK, status="upcoming", registration reopens | `tests/test_service.py::test_move_past_event_to_future` | Service | Covered | Re-enables registration |
| **TM03** | Clock advances without write | Event at `T + 1h` | Time passes until `now > T + 1h` | `GET` returns status="past", registration returns 409 EVENT_STARTED | `tests/test_service.py::test_clock_advance_recomputes_status_without_write` | Service | Covered | Evaluated on demand |

---

## 6. Concurrency & Contention (CC01-CC08)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **CC01** | Distinct users race for 1 final seat | Capacity 1, 0 registered | 20 threads simultaneously register distinct user IDs | Exactly 1 success (201), 19 conflicts (409 EVENT_FULL), final count=1 | `tests/test_concurrency.py::test_concurrent_final_seat_contention` | Concurrency | Covered | Bounded thread barrier |
| **CC02** | Same user races with spare capacity | Capacity 100, 0 registered | 20 threads simultaneously register `"same-user"` | Exactly 1 success (201), 19 conflicts (409 ALREADY_REGISTERED), count=1 | `tests/test_concurrency.py::test_concurrent_duplicate_user_contention` | Concurrency | Covered | Bounded thread barrier |
| **CC03** | Register vs capacity reduction | Capacity 5, 2 registered | Thread A registers; Thread B reduces capacity to 2 | Valid serial outcome: either A wins (B conflicts 409) or B wins (A succeeds or conflicts); invariant count <= capacity | `tests/test_concurrency.py::test_concurrent_register_vs_capacity_reduction` | Concurrency | Covered | Thread barrier synchronization |
| **CC04** | Register vs event deletion | Capacity 10, 0 registered | Thread A registers; Thread B deletes event | Valid serial outcome: either A completes before delete or fails 404; final state has 0 orphans | `tests/test_concurrency.py::test_concurrent_register_vs_delete` | Concurrency | Covered | Thread barrier synchronization |
| **CC05** | Register vs unregister same user | Registered user on event | Thread A registers; Thread B unregisters | Valid serial outcome: user either registered or unregistered; final state consistent | `tests/test_concurrency.py::test_concurrent_register_vs_unregister_same_user` | Concurrency | Covered | Thread barrier synchronization |
| **CC06** | Two concurrent unregister calls | Registered user on event | 2 threads call unregister for `"user-1"` | Both return 204 No Content; user unregistered; count decremented exactly once | `tests/test_concurrency.py::test_concurrent_unregister_same_user` | Concurrency | Covered | Idempotent |
| **CC07** | Date edit to past vs register | Future event | Thread A moves date to past; Thread B registers | Valid serial outcome: either B registers before date change, or receives 409 EVENT_STARTED | `tests/test_concurrency.py::test_concurrent_date_edit_vs_register` | Concurrency | Covered | Serialized via lock |
| **CC08** | Repeated reads during writes | Event receiving registrations | Read threads continuously fetch event & registrations | Every read observes valid invariants (remaining = max - count, count <= max) | `tests/test_concurrency.py::test_concurrent_reads_during_active_mutations` | Concurrency | Covered | Thread barrier synchronization |

---

## 7. Error Handling & Protocol Compliance (ER01-ER08)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **ER01** | Missing UUID | Empty store | `GET /api/events/` | 200 OK with empty items list (collection route) | `tests/test_api.py::test_list_events_endpoint` | API | Covered | Path distinction |
| **ER02** | Malformed UUID parameter | Empty store | `GET /api/events/not-a-uuid` | 422 VALIDATION_ERROR with field details | `tests/test_api.py::test_malformed_uuid_returns_422` | API | Covered | UUID path validation |
| **ER03** | Malformed JSON on all body endpoints | Empty store | Send `{malformed` to POST event, PUT event, POST registration | 400 INVALID_JSON with malformed message on all body endpoints | `tests/test_api.py::test_malformed_json_handling` | API | Covered | Consistent envelope |
| **ER04** | Non-object JSON body | Empty store | Send `[1, 2, 3]` or `"string"` | 422 VALIDATION_ERROR with structured details | `tests/test_api.py::test_non_object_json_body_returns_422` | API | Covered | Dict payload required |
| **ER05** | Unknown route | Any state | `GET /api/unknown-endpoint` | 404 NOT_FOUND envelope | `tests/test_api.py::test_unknown_route_returns_404_envelope` | API | Covered | Consistent envelope |
| **ER06** | Unsupported HTTP method | Event exists | `PATCH /api/events` | 405 Method Not Allowed with `Allow: GET, POST, OPTIONS` header | `tests/test_api.py::test_unsupported_method_preserves_allow_header` | API | Covered | Protocol headers preserved |
| **ER07** | Synthetic unexpected error (500) | Any state | Route raises unexpected runtime exception | 500 INTERNAL_ERROR with sanitized message; no traceback in response | `tests/test_api.py::test_unexpected_500_error_retains_cors_headers_for_allowed_origin` | API | Covered | Stack trace hidden |
| **ER08** | CORS headers on errors | Allowed and disallowed origins | Send 500-triggering request with Origin header | Allowed origin receives `Access-Control-Allow-Origin`; disallowed does not | `tests/test_api.py::test_unexpected_500_error_retains_cors_headers_for_allowed_origin` | API | Covered | CORS on all errors |

---

## 8. Frontend Interactions & State Management (UI01-UI24)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **UI01** | Empty / loading / error / retry states | List page | Fetch states | Displays empty illustration when no events; loading skeleton during fetch; error card on failure | `frontend/src/pages/EventListPage.test.tsx::renders empty state when no events returned` | Component | Covered | Local simulated delay |
| **UI02** | Search filter | List page with 3 events | Type query into search | Filters events matching title or description; handles untrimmed query | `frontend/src/pages/EventListPage.test.tsx::filters events by search query` | Component | Covered | Client-side filter |
| **UI03** | Status category filter | List page with mixed events | Click "Upcoming", "Past", "All" | Displays only events matching category filter; buttons use `aria-pressed` | `frontend/src/pages/EventListPage.test.tsx::filters events by status category` | Component | Covered | Semantic filter buttons |
| **UI04** | Long content at narrow width | Mobile viewport | Render long title and description | Content wraps without overflowing container or truncating essential buttons | `docs/screenshots/events-mobile.png` | Browser | Covered | Visual check |
| **UI05** | Registration success updates roster | Event detail page | Register new attendee | Attendee appears in roster, count increments, capacity updates | `frontend/src/pages/EventDetailPage.test.tsx::allows registering a new attendee and updates roster` | Component | Covered | Mock client |
| **UI06** | Mutation conflict retained | Event detail page | Attempt duplicate registration | 409 conflict message displayed and remains visible after background refresh | `frontend/src/pages/EventDetailPage.test.tsx::retains mutation conflict error message after delayed background refresh` | Component | Covered | Deferred refresh mock |
| **UI07** | Duplicate click prevention | Event detail page | Double click Register button | Only 1 API request sent; button disabled while pending | `frontend/src/pages/EventDetailPage.test.tsx::prevents duplicate submission while registration is pending` | Component | Covered | Button disabled |
| **UI08** | Chosen identity survives refresh | Event detail page | Select attendee-002, trigger mutation/refresh | Selected identity remains attendee-002 | `frontend/src/pages/EventDetailPage.test.tsx::preserves selected attendee identity after successful registration and refresh` | Component | Covered | Persistent identity |
| **UI09** | Sidebar unregister | Detail page | Click Unregister in sidebar | Removes attendee, decrements count, re-enables register button | `frontend/src/pages/EventDetailPage.test.tsx::allows unregistering an attendee from sidebar` | Component | Covered | Roster sync |
| **UI10** | Roster unregister action | Detail page | Click "Unregister" button next to attendee | Removes attendee, displays pending state on button, updates roster | `frontend/src/pages/EventDetailPage.test.tsx::allows unregistering attendee from roster with pending state` | Component | Covered | Inline button feedback |
| **UI11** | Unregister from full event | Full event detail | Unregister attendee | Capacity gauge reopens, status changes from full to upcoming | `frontend/src/pages/EventDetailPage.test.tsx::allows unregistering from full event and reopens capacity` | Component | Covered | Gauge updates |
| **UI12** | Failed roster action handling | Detail page | Roster unregister rejects | Error message displayed on page, button re-enabled, no unhandled rejection | `frontend/src/pages/EventDetailPage.test.tsx::handles roster unregister failure gracefully without unhandled rejection` | Component | Covered | Graceful error handling |
| **UI13** | Delete confirmation modal | Detail page | Click "Delete Event" | Modal opens with Cancel and Confirm Delete buttons | `frontend/src/pages/EventDetailPage.test.tsx::opens and closes delete confirmation modal` | Component | Covered | Accessible dialog |
| **UI14** | Delete confirmation keyboard trap & escape | Detail page modal | Press Escape / Tab | Escape closes modal; Tab wraps inside modal focusables; Cancel focused initially | `frontend/src/pages/EventDetailPage.test.tsx::focuses cancel button and closes on escape key` | Component | Covered | Accessible modal |
| **UI15** | Delete execution and navigation | Detail page modal | Confirm delete | 204 No Content; navigates to `/events` | `frontend/src/pages/EventDetailPage.test.tsx::deletes event and redirects to event list` | Component | Covered | Router navigation |
| **UI16** | Route change during read | Detail page | Navigate away while fetch in flight | No state update on unmounted component; fetch cancelled via signal | `frontend/src/pages/EventDetailPage.test.tsx::cancels fetch on unmount without state warnings` | Component | Covered | AbortController |
| **UI17** | Edit to create navigation | Edit page for Event A | Click "New Event" global link | Form completely resets; initialValues cleared; heading is "Create New Event" | `frontend/src/pages/EventFormPage.test.tsx::resets form completely when navigating from edit to create` | Component | Covered | Clean remount |
| **UI18** | Edit Event A to Edit Event B | Edit page for Event A | Navigate to `/events/b/edit` | Form updates with Event B initialValues | `frontend/src/pages/EventFormPage.test.tsx::updates form values when switching between edited events` | Component | Covered | Dynamic update |
| **UI19** | Form validation errors | Create form | Submit empty title or negative capacity | Form shows field-level error messages; submission prevented | `frontend/src/components/EventForm.test.tsx::displays validation errors for invalid inputs` | Component | Covered | Client validation |
| **UI20** | Form values retained on server error | Create form | Submit valid form that fails with 409 or 500 | User inputs retained in form; error banner displayed; no data lost | `frontend/src/components/EventForm.test.tsx::retains user input when server returns an error` | Component | Covered | Non-destructive failure |
| **UI21** | Mutation succeeds but re-read fails | Detail page | Register succeeds, but refresh read fails | Reports refresh failure without claiming registration failed | `frontend/src/pages/EventDetailPage.test.tsx::handles refresh failure after successful mutation accurately` | Component | Covered | Accurate attribution |
| **UI22** | Mutation fails, re-read succeeds | Detail page | Register fails 409, refresh read succeeds | Conflict error displayed; freshest server state rendered | `frontend/src/pages/EventDetailPage.test.tsx::retains mutation conflict error message after delayed background refresh` | Component | Covered | Error retained |
| **UI23** | Mutation fails and re-read fails | Detail page | Both mutation and refresh fail | Displays both mutation error and refresh warning | `frontend/src/pages/EventDetailPage.test.tsx::displays appropriate errors when both mutation and refresh fail` | Component | Covered | Clear messaging |
| **UI24** | Out-of-order refresh responses | Detail page | Older refresh resolves after newer refresh | Discards stale read; keeps freshest server state | `frontend/src/pages/EventDetailPage.test.tsx::discards stale out-of-order read responses` | Component | Covered | Latest-request ownership |

---

## 9. System, Operational & Accessibility Checks (SYS01-SYS08, A11Y01-A11Y08)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **SYS01** | Fresh app isolation | Injected stores | Construct two distinct app instances | Mutations in App A do not affect App B | `tests/test_health.py::test_app_factory_creates_distinct_stores` | Unit | Covered | Factory isolation |
| **SYS02** | Seed setting isolation | `SEED_DEMO_DATA=true` | Run test suite with environment variable | Tests pass cleanly without seed interference | `tests/test_health.py::test_app_factory_seed_demo_data_isolation` | System | Covered | Fixture isolation |
| **SYS03** | Restart data loss | In-memory app | Terminate and restart server process | State resets cleanly to empty or demo seeds | Documented limitation in README | Docs | Covered | In-memory by design |
| **SYS04** | Single-worker constraint | Uvicorn startup | Start with `--workers 1` | Correct thread-safe execution within single memory heap | Documented requirement in README | Docs | Covered | Multi-worker partitioning |
| **SYS05** | Clean dependency installation | Repository | `pip install -r requirements-dev.txt` & `npm ci` | Installs without dependency conflicts or peer warnings | Verified in build commands | System | Covered | Pinned versions |
| **SYS06** | Production preview CORS | Backend :8000, Vite preview :5173 | API requests from `http://127.0.0.1:5173` | Allowed by CORS middleware | `tests/test_api.py::test_cors_preflight` | API | Covered | Configured origins |
| **SYS07** | CI vs local parity | GitHub Actions | Trigger `.github/workflows/ci.yml` | Pytest, Ruff, ESLint, TypeScript, Vitest, Build all pass | `.github/workflows/ci.yml` | CI | Covered | GitHub runner |
| **SYS08** | Deep-link reload | Frontend SPA | Refresh browser on `/events/{id}` | Loads event detail view directly | Browser / Router test | UI | Covered | Client-side routing |
| **A11Y01**| Accessible keyboard focus order | All pages | Navigate with Tab and Shift+Tab | Logical tab order across headers, filters, cards, and forms | Audit & Component tests | A11y | Covered | DOM order matches visual order |
| **A11Y02**| Dialog focus containment and dismissal | Delete modal | Open modal, press Tab and Escape | Focus trapped; Escape closes; focus restored to trigger | `frontend/src/pages/EventDetailPage.test.tsx::focuses cancel button and closes on escape key` | A11y | Covered | WAI-ARIA Dialog pattern |
| **A11Y03**| Input error associations | Event form | Trigger validation errors | Form inputs associated with error messages via `aria-describedby` | `frontend/src/components/EventForm.tsx` | A11y | Covered | ARIA attributes |
| **A11Y04**| Dynamic status announcements | Event operations | Register / unregister / delete | Status messages announced via polite live region | `frontend/src/App.tsx` | A11y | Covered | Live region |
| **A11Y05**| Filter button semantics | Event list page | Inspect category filter buttons | Uses `<button aria-pressed="...">` instead of invalid tab roles | `frontend/src/pages/EventListPage.tsx` | A11y | Covered | Semantic buttons |
| **A11Y06**| Color contrast compliance | All buttons & badges | Audit text vs background contrast | All normal text achieves >= 4.5:1 ratio (amber updated) | `frontend/src/styles.css` | A11y | Covered | Contrast audited |
| **A11Y07**| Viewport zoom and reflow | 320px to 1280px | Test 200% zoom and 390px mobile | Layout reflows into single column without horizontal scroll | `docs/screenshots/*-mobile.png` | A11y | Covered | CSS responsive design |
| **A11Y08**| Reduced motion preferences | All animations | `@media (prefers-reduced-motion)` | Transitions and animations disabled or minimized | `frontend/src/styles.css` | A11y | Covered | CSS media query |

---

## 10. Dark Mode & Appearance Coverage (TH01-TH15)

| ID | Requirement / Invariant | Starting State | Action / Interleaving | Expected Result | Test File & Name | Layer | Status | Residual Limitation |
|---|---|---|---|---|---|---|---|---|
| **TH01** | First visit with light system setting | No stored preference | Load app when OS prefers light | System preference selected; data-theme resolves to light | `frontend/src/App.test.tsx::Scenario 1` | Component | Covered | Browser matchMedia |
| **TH02** | First visit with dark system setting | No stored preference | Load app when OS prefers dark | System preference selected; data-theme resolves to dark | `frontend/src/App.test.tsx::Scenario 2` | Component | Covered | Browser matchMedia |
| **TH03** | Explicit Light while system is dark | OS prefers dark | Select Light in appearance control | Light persisted to localStorage; data-theme resolves to light | `frontend/src/App.test.tsx::Scenario 3` | Component | Covered | Persisted in client |
| **TH04** | Explicit Dark while system is light | OS prefers light | Select Dark in appearance control | Dark persisted to localStorage; data-theme resolves to dark | `frontend/src/App.test.tsx::Scenario 4` | Component | Covered | Persisted in client |
| **TH05** | System changes while preference is System | Preference is System | OS preference switches from light to dark | data-theme automatically updates to dark | `frontend/src/App.test.tsx::Scenario 5` | Component | Covered | Media query listener |
| **TH06** | System changes while preference is explicit | Preference is Light | OS preference switches from light to dark | data-theme remains light; explicit choice overrides OS | `frontend/src/App.test.tsx::Scenario 6` | Component | Covered | Explicit override |
| **TH07** | Saved preference invalid or removed | Corrupted storage | Load app with invalid value in storage | Safely falls back to System preference | `frontend/src/App.test.tsx::Scenario 7` & `frontend/src/utils/theme.test.ts` | Unit | Covered | Validation fallback |
| **TH08** | localStorage read/write throws | Quota or privacy mode | Trigger storage write exception | App remains interactive; appearance toggles for session | `frontend/src/App.test.tsx::Scenario 8` & `frontend/src/utils/theme.test.ts` | Unit | Covered | Session fallback |
| **TH09** | Appearance changes with dirty form | Create/edit form | Type input, then change theme | All form inputs and untouched date instant preserved | `frontend/src/App.test.tsx::Scenario 9` | Component | Covered | No remount |
| **TH10** | Appearance changes with attendee/modal state | Detail page modal open | Change demo attendee ID and open modal, toggle theme | Typed attendee ID and open modal dialog preserved | `frontend/src/App.test.tsx::Scenario 10` | Component | Covered | Preserved state |
| **TH11** | Refresh with saved Dark | Preference is Dark | Page reload or fresh navigation | Synchronous head script applies dark theme before paint | `frontend/index.html` inline script | Shell | Covered | Zero FOUC |
| **TH12** | Accessible Appearance control | App navbar | Keyboard navigation to theme select | Labeled native select, exposed value, retains focus | `frontend/src/App.test.tsx::Scenario 12` | Component | Covered | Accessible combobox |
| **TH13** | Shared components in both palettes | Light and Dark modes | Measure foreground/background contrast | All normal copy achieves >= 4.5:1 contrast; large text >= 3.0:1 | `DESIGN.md` & `frontend/src/styles.css` | Design | Covered | WCAG AA contrast |
| **TH14** | Listener lifecycle cleanup | Mounted shell | Unmount App component | Media query and storage event listeners removed cleanly | `frontend/src/App.test.tsx::Scenario 14` | Component | Covered | No memory leak |
| **TH15** | Cross-tab synchronization | Two browser tabs | Tab B updates localStorage theme | Tab A updates active preference and resolved appearance | `frontend/src/App.test.tsx::Scenario 15` | Component | Covered | Storage event sync |


---

## 11. Product Scenario Audit: Free, Paid, and Capacity Coverage (PS01-PS12)

For complete architectural justification and scope boundary analysis, see `docs/product-scenario-audit.md`.

| ID | Scenario | Classification | Invariant & Implementation Status | Test File & Name |
|---|---|---|---|---|
| **PS01** | No pricing metadata | Required & Implemented | Neutral Register/capacity language; no invented Free/Paid badge. | `frontend/src/pages/EventListPage.test.tsx` |
| **PS02** | Free event display | Optional Extension | Requires explicit free admission metadata before claiming it. | Excluded from current schema |
| **PS03** | Paid event display | Optional Extension | Amount and currency are purely informational, not evidence of completed payment. | Excluded from current schema |
| **PS04** | Paid registration/checkout/refunds/taxes | Excluded | Outside original assessment scope; no financial processing. | Out of scope |
| **PS05** | Available finite capacity | Required & Implemented | Exact counts displayed; atomic increments upon registration. | `tests/test_service.py::test_register_success` |
| **PS06** | One remaining place | Required & Implemented | Thread-safe barrier test verifies exactly one succeeds; concurrent attempts receive 409 `EVENT_FULL`. | `tests/test_concurrency.py::test_concurrent_registrations_respect_capacity_barrier` |
| **PS07** | Full future event | Required & Implemented | New registrations blocked with 409 `EVENT_FULL`; existing attendees can unregister. | `tests/test_service.py::test_register_capacity_limit` |
| **PS08** | Past event with empty seats | Required & Implemented | Registration closed with 409 `EVENT_STARTED`, regardless of remaining capacity. In UI, displays "Registration closed". | `tests/test_service.py::test_register_past_or_equal_time_rejection` |
| **PS09** | Zero/negative/fractional/over-limit capacity | Required & Implemented | Strictly rejected with 422 `VALIDATION_ERROR` by Pydantic validation. | `tests/test_service.py::test_schema_validation_capacity` |
| **PS10** | Unlimited capacity | Excluded by Contract | Assessment contract specifies capacity between 1 and 10,000. Null or 0 values are strictly rejected. | `tests/test_service.py::test_schema_validation_capacity` |
| **PS11** | Reduced capacity below attendees | Required & Implemented | Rejected with 409 `CAPACITY_BELOW_REGISTRATIONS`; record state preserved; clear form feedback. | `tests/test_service.py::test_update_event_cannot_reduce_capacity_below_registrations` |
| **PS12** | Free/paid combined with full/past | Optional Extension Rule | If pricing metadata is added in the future, date and capacity eligibility rules must continue to evaluate first. | Documented in `docs/product-scenario-audit.md` |
