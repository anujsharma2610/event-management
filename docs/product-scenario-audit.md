# Product Scenario Audit: Free, Paid, and Capacity Handling

This document provides a technical audit of the Event Management application's handling of event capacity and the architectural status of free versus paid admissions.

## Current Contract and Schema Analysis

Inspection of the domain entities (`backend/app/models.py`), request schemas (`backend/app/schemas.py`), and frontend interfaces (`frontend/src/api/types.ts`) confirms:
- **Capacity**: Required integer field `maxCapacity` strictly bounded between 1 and 10,000. Real-time counter `registrationCount` and calculated remaining seats `remainingCapacity` are returned on every query. Thread-safe atomic critical sections prevent overbooking.
- **Pricing**: Completely absent from the schema. There is no `price`, `currency`, `tier`, `ticketType`, or `isFree` attribute in the backend model or frontend state. Registration performs seat reservations without financial transactions.
- **Scope Alignment**: The supplied assessment specification defines an Event Management and Attendee Registration system with finite seat limits. Financial checkout, payment gateway processing, refund workflows, and tax computations were not included in the core evaluation criteria.

## Scenario Classification Matrix

Each product scenario is classified into one of four categories:
1. **Required & Implemented**: Part of the core assessment contract, fully implemented and backed by automated tests.
2. **Partially Covered**: Exercised in logic but subject to documented operational bounds.
3. **Optional Extension**: Well-defined future capability that requires schema and API migrations before claiming support.
4. **Excluded**: Intentionally out of scope for the assessment.

| Scenario | Required Outcome or Scope Decision | Status | Technical Evidence & Invariants |
|---|---|---|---|
| **No pricing metadata** | Neutral registration and capacity language; no invented Free or Paid badges. | Required & Implemented | Labels use direct action verbs ("Register", "Unregister") and seat counts ("18 of 30 registered", "12 places left"). No decorative pricing badges appear in the UI. |
| **Free event display** | Optional extension; requires explicit free admission metadata in the backend schema before claiming it. | Optional Extension | Currently excluded from display. The application does not assume missing pricing implies "Free Admission". |
| **Paid event display** | Optional extension; amount and currency metadata are purely informational, not evidence of completed payment. | Optional Extension | Out of current schema scope. If introduced, requires schema fields `priceCents: int` and `currency: str`. |
| **Paid registration, checkout, refunds, taxes** | Outside original assessment scope; no payment processing or third-party gateways in this project. | Excluded | Financial transactions require external PCI-compliant processors (e.g. Stripe) and persistent audit databases, outside this in-memory exercise. |
| **Available finite capacity** | Exact counts displayed; atomic increment upon registration. | Required & Implemented | Covered by `tests/test_service.py::test_register_success` and frontend `EventDetailPage.test.tsx`. Counters update immediately. |
| **One remaining place** | Clear availability; concurrent registration requests cannot exceed capacity. | Required & Implemented | Verified by barrier-synchronized multithreading test `tests/test_concurrency.py::test_concurrent_registrations_respect_capacity_barrier`. Exactly one request succeeds; all concurrent attempts receive HTTP 409 `EVENT_FULL`. |
| **Full future event** | New registrations blocked with HTTP 409 `EVENT_FULL`; existing attendees can unregister. | Required & Implemented | Verified by `tests/test_service.py::test_register_capacity_limit` and `test_unregister_and_reregister`. Full status does not block unregistration. |
| **Past event with empty seats** | Registration closed with HTTP 409 `EVENT_STARTED`, regardless of remaining capacity. | Required & Implemented | Verified by `tests/test_service.py::test_register_past_or_equal_time_rejection`. In the UI, past events display "Registration closed" rather than an active CTA. |
| **Zero, negative, fractional, or over-limit capacity** | Rejected with HTTP 422 `VALIDATION_ERROR` by Pydantic validation. | Required & Implemented | Verified by `tests/test_service.py::test_schema_validation_capacity` for bounds 0, -5, 10001, bools, floats, and strings. |
| **Unlimited capacity** | Not part of original contract; zero is rejected and must not be used as an undocumented sentinel. | Excluded by Contract | Assessment contract specifies capacity between 1 and 10,000. Null or 0 values are strictly rejected. |
| **Reduced capacity below attendees** | Rejected with HTTP 409 `CAPACITY_BELOW_REGISTRATIONS`; event state preserved; clear form feedback. | Required & Implemented | Verified by `tests/test_service.py::test_update_event_cannot_reduce_capacity_below_registrations` and frontend form error handling. |
| **Free or paid combined with full or past** | Pricing labels must never override date or capacity eligibility rules. | Optional Extension Rule | If pricing is added in the future, date (`date <= now`) and capacity (`count >= max`) eligibility gates must continue to evaluate first. |

## Honest Representation Policy

1. **No Fake Badges**: The frontend does not inject "Free" badges onto event cards. Displaying a "Free" badge when no pricing model exists misleads users into expecting paid events to be supported.
2. **No Mock Checkout**: The application does not render checkout buttons, credit card forms, or ticket selection modals that perform no actual processing.
3. **Capacity Transparency**: Seat availability is clearly presented across the UI using precise numbers (e.g. "2 spots remaining" or "30 / 30 seats filled").

## Architectural Blueprint for Future Pricing Extension

If paid events are authorized in a future iteration, the extension should follow these standards:
- **Storage Representation**: Store price as an integer representing the smallest currency unit (e.g. `priceCents: int = 1500` for \$15.00) paired with an ISO 4217 currency code (`currency: str = "USD"`). Never use floating-point numbers for currency amounts.
- **Contract Migration**: Make pricing optional with explicit default:
  ```python
  class EventCreate(BaseModel):
      title: str
      description: str = ""
      date: datetime
      maxCapacity: int
      priceCents: int | None = Field(default=None, ge=0)
      currency: str | None = Field(default=None, min_length=3, max_length=3)
  ```
- **Admission Disclosure**: When `priceCents` is provided without a payment processor, the UI must explicitly state: "Informational pricing only. Payment is not collected through this demo application."
- **Precedence**: Business conflict rules (`EVENT_STARTED`, `EVENT_FULL`, `ALREADY_REGISTERED`) must continue to execute before any reservation confirmation.
