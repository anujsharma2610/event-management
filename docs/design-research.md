# Mobbin Design Research Log

This document records the primary research conducted using the Mobbin search tool, capturing the verified reference links, observations, and decisions implemented across each target screen.

## Target 1: Welcome and Entry Experience

### Research Query & Results
- **Search Query**: "empty workspace get started screen with action buttons", Platform: web, Mode: deep
- **References**:
  - [Midday (Web)](https://mobbin.com/screens/8088de4e-587d-4e03-b24e-20a91ec2aea7): Minimalist workspace overview featuring a bold heading, concise explanation, and two obvious next actions ("Get started" and secondary documentation/settings link).
  - [Render (Web)](https://mobbin.com/screens/63958e19-2913-4d0e-85d9-39c9654e106b): Clean entry guide highlighting core services and quick start actions without modal gates or forced onboarding.
  - [Laravel Cloud (Web)](https://mobbin.com/screens/b54903e7-e288-4eb2-8e47-12c2e1423976): High-contrast hero layout with direct links to create applications or explore active services.

### Key Observations
1. Modern web workspaces avoid intrusive full-screen onboarding modals that block returning users.
2. A welcome page works best as a lightweight guide: clear summary of what the system does, immediate links to view or create items, and transparent documentation for demo data.
3. Empty directories provide a focused first-run state that directs the user to either create an event or opt into sample seeds.

### Implemented Decisions
- Created a dedicated, non-blocking Welcome route (`/welcome`, accessible via a "Guide" navbar link) that explains the core architecture (Event CRUD, atomic capacity, attendee registrations, timezone handling, dark mode).
- Paired the welcome route with an actionable empty directory state on `/` when 0 events exist, providing a direct "Create event" action and a note on `SEED_DEMO_DATA=true`.
- Avoided forced registration gates, authentication walls, mock analytics, or artificial onboarding wizards.

---

## Target 2: Event Directory

### Research Query & Results
- **Search Query**: "events list dashboard with status and filters", Platform: web, Mode: deep
- **References**:
  - [Posh (Web)](https://mobbin.com/screens/3fad44f7-7615-425b-accb-68cd6e60007b): Card-based event directory with high-contrast dates, bold titles, status indicators, and clean action links.
  - [Eventbrite (Web)](https://mobbin.com/screens/839e9d79-bec7-4c55-9d58-6641950fc6d4): Category filter tabs with exact item counts, instant keyword search, and capacity status badges.
  - [Meetup (Web)](https://mobbin.com/screens/acefe8c4-744e-4089-a7be-d6703dd3251e): Clean event rows with structured calendar tiles, location/time rows, and attendee counts.

### Key Observations
1. Scanning is fastest when the calendar date is presented as an independent tile (month header, numeric day) separated from the event title.
2. Filter tabs should show accurate numeric badges for each category ("All", "Upcoming", "Past") so users know count distributions before clicking.
3. Past events must communicate closure ("Registration closed (24 attended)") rather than displaying remaining seats as an active invitation.

### Implemented Decisions
- Lead with an editorial `h1` "Events" heading (`clamp(2rem, 4vw, 3rem)`, weight 800) and an understated scheduled event count.
- Structured filter tabs with exact counts and an accessible SVG magnifying glass search input.
- Added visual capacity progress bar with state-specific fills (emerald for upcoming, amber for full, muted slate for past).
- Refactored card actions to direct "View details" (or "View event" for past events) and "Edit".

---

## Target 3: Event Details & Attendee Registration

### Research Query & Results
- **Search Query**: "event details page with attendees and rsvp registration", Platform: web, Mode: deep
- **References**:
  - [Luma (Web)](https://mobbin.com/screens/2cf18eda-52c1-4922-9e89-17a8418143a5): Two-column responsive desktop layout. Main column features the prominent event title, date/time/timezone meta strip, description, and attendee roster. Right column houses a sticky registration card.
  - [Partiful (Web)](https://mobbin.com/screens/47f7e4fc-ec35-4d91-8417-cd5ced6c1f03): Distinct attendee RSVP card with clear confirmation state ("You are registered"), quick unregister action, and searchable guest list.
  - [Posh (Web)](https://mobbin.com/screens/1f7bb6ff-93dd-4805-8ce6-3dfd65d12100): Unified capacity gauge, explicit status badges, and separate host controls.

### Key Observations
1. Breaking capacity and status into three separate decorative cards adds clutter without aiding comprehension. A single cohesive strip is faster to read.
2. In an ID-only attendee model, arbitrary multi-colored gradient avatars create artificial visual noise. Clean SVG user icons and monospace IDs are more readable.
3. Host management controls (Edit, Delete) must not visually compete with attendee registration.

### Implemented Decisions
- Formatted event title as `h1` at 36 to 48px (`clamp(2rem, 3.5vw, 2.75rem)`), weight 800.
- Replaced three separate metric cards with a compact availability summary strip (Booked ratio, Remaining seats, Status) with tabular numerals.
- Clean attendee roster with monospace `<code>{attendee.userId}</code>`, registration timestamps, and per-row unregister actions with active "Removing..." pending states.
- Labeled Attendee ID input with instant validation and status guidance cards for registered, full, closed, and open states.
- Subdued host controls with secondary outline buttons.

---

## Target 4 & 5: Create and Edit Event Forms

### Research Query & Results
- **Search Query**: "create event form with date capacity and settings", Platform: web, Mode: deep
- **References**:
  - [Luma (Web)](https://mobbin.com/screens/6543c6f2-ed3c-47d0-b332-7002834a9da2): Single-page event creation form with clean section grouping, date/time inputs, capacity settings, and direct action bar.
  - [Eventbrite (Web)](https://mobbin.com/screens/93dd0ebc-c2c7-4d40-b697-99e4bad0e2cb): Clear input labels, character counter hints, and explicit capacity limits.
  - [Circle (Web)](https://mobbin.com/screens/b360aa69-e3f5-4404-af95-8021ce320f4b): Timezone callout banner explaining that wall-clock input is converted to UTC instants when saved.

### Key Observations
1. Numbered step wizard badges (1, 2, 3) on a short single-page form create false expectations of a multi-step process. Clean semantic sections are more natural.
2. Users need to understand which timezone their datetime input uses without wading through technical UTC explanations.
3. Editing an event must preserve untouched timestamp precision (F07) to avoid truncating seconds or fractions.

### Implemented Decisions
- Organized forms into three clean semantic sections: Basic Information, Date & Time, Capacity & Reservation Limits.
- Replaced technical UTC prose with a direct timezone callout: "Times are in your local timezone ({timezone}). Registrations close at the start time."
- Maintained F07 raw timestamp precision preservation when dates are untouched during edits.
- Enforced 16px minimum font size on mobile inputs to eliminate iOS Safari auto-zoom.

---

## Target 6: Navigation, Dialogs, Empty/Error/Loading States

### Research Query & Results
- **Search Query**: "delete confirmation dialog modal with warning", Platform: web, Mode: deep
- **References**:
  - [Clerk (Web)](https://mobbin.com/screens/de2ed754-dcb1-4e66-867f-45c5f6c9ed41): Clear confirmation modal with distinct title, warning banner detailing irreversible consequences, and secondary Cancel alongside danger action.
  - [GoFundMe (Web)](https://mobbin.com/screens/92304113-4589-4e49-b1b0-0194d6b0a68e): Accessible modal dialog with focus containment, clear description, and explicit action labels.
  - [Qatalog (Web)](https://mobbin.com/screens/87535ac9-5efd-4412-a6a3-262ba9009e9c): Destructive action dialog with keyboard accessibility and high contrast.

### Key Observations
1. Destructive actions require unambiguous confirmation stating what will be permanently deleted (e.g. event record plus all registered attendees).
2. Modals must trap Tab key focus and close on Escape (F08), restoring focus to the trigger button upon dismissal.
3. Exceptional states (404 Not Found, loading spinners, error alerts) should share the same typographic and spacing scale as main pages.

### Implemented Decisions
- Accessible delete confirmation modal with focus containment trap and Escape key listener.
- Dedicated 404 Recovery view with prominent 404 code and return action link.
- High-contrast empty states for directory and filtered search results with "Clear filters" action.
