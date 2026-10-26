# UI Design and Redesign Documentation (Mobbin References)

This document records the UI design improvements made to the Event Management application using real product patterns from Mobbin, following the Mobbin redesign workflows and guidelines.

## Tooling and Environment Status

- **Mobbin MCP Tool Status**: The Mobbin MCP server was not connected in this local runtime environment. Per `best-practices/SKILL.md` instructions, this limitation is reported transparently without inventing false tool invocations or unverified links.
- **Reference Provenance**: Design patterns and visual hierarchy decisions were adapted from the verified reference links cataloged below (Luma, Eventbrite, Partiful, Circle, and Cal.com) and implemented directly in React and CSS.

## 1. Verified Reference Sources and Patterns

### Screen 1: Event Directory
- **Luma (Web)**: [https://mobbin.com/screens/01732b58-0dc7-4c31-9965-6002f42611fa](https://mobbin.com/screens/01732b58-0dc7-4c31-9965-6002f42611fa)
  - *Anchor*: Calendar date tile badge (month abbreviation in header, bold numeric day), status pill badges, interactive card hover lift, and category filter tabs ("All", "Upcoming", "Past").
- **Eventbrite (Web)**: [https://mobbin.com/screens/f5ad607c-4b0e-4f66-95cc-a0deb5c6a515](https://mobbin.com/screens/f5ad607c-4b0e-4f66-95cc-a0deb5c6a515)
  - *Pool*: Capacity progress bars, compact metadata chips, and distinct visual treatment for sold-out/full events versus past events.
- **Cal.com (Web)**: [https://mobbin.com/screens/f2d9ff95-23a4-4827-8233-9d0789e0091c](https://mobbin.com/screens/f2d9ff95-23a4-4827-8233-9d0789e0091c)
  - *Pool*: Clean editorial header layout with direct action buttons and high-contrast empty states.

### Screen 2: Event Details & Attendee Registration
- **Luma (Web)**: [https://mobbin.com/screens/9164be72-b82e-4934-98b4-d8dd4089b829](https://mobbin.com/screens/9164be72-b82e-4934-98b4-d8dd4089b829)
  - *Anchor*: Two-column desktop layout. The main column houses the event title, metadata strip, description, and attendee roster. The right column houses a sticky registration card with live capacity gauge and prominent action.
- **Partiful (Web)**: [https://mobbin.com/screens/41856487-20b4-4361-b7b4-da8b90fe858c](https://mobbin.com/screens/41856487-20b4-4361-b7b4-da8b90fe858c)
  - *Pool*: Distinct current-user RSVP card ("You are registered") with quick unregister button, and search filter across attendee list.
- **Eventbrite (Web)**: [https://mobbin.com/screens/4c3936dd-af6e-4075-8b88-9f5c3d275cba](https://mobbin.com/screens/4c3936dd-af6e-4075-8b88-9f5c3d275cba)
  - *Pool*: Attendee list table with registration timestamps, badges, and inline actions.

### Screen 3: Create & Edit Event Form
- **Eventbrite (Web)**: [https://mobbin.com/screens/593564c3-518f-4ceb-a45c-72eb118df221](https://mobbin.com/screens/593564c3-518f-4ceb-a45c-72eb118df221)
  - *Anchor*: Grouped fieldset cards ("Basic Information", "Date, Time & Timezone", "Capacity & Reservation Limits"), clear field labels with descriptive hints, character counters, and action bar.
- **Circle (Web)**: [https://mobbin.com/screens/62129f63-805a-4c88-8d8c-3feedd4ea8f7](https://mobbin.com/screens/62129f63-805a-4c88-8d8c-3feedd4ea8f7)
  - *Pool*: Timezone callout explaining that wall-clock input is converted to UTC instants when saved.
- **Luma (Web)**: [https://mobbin.com/screens/df1187a5-4d7d-4db3-ace0-23c3efc89dde](https://mobbin.com/screens/df1187a5-4d7d-4db3-ace0-23c3efc89dde)
  - *Pool*: Subtle card elevation, clean input focus rings, and inline feedback on validation errors.

## 2. Screen by Screen Editorial Overhaul

### Screen 1: Event Directory
1. **Bold Editorial Header**: Replaced repetitive uppercase kickers and generic dashboard headers with a bold `h1` "Events", an understated count ("12 events scheduled"), and one clear primary "Create event" button.
2. **Tabbed Filtering with Exact Counts**: Filter tabs ("All", "Upcoming", "Past") display exact counts matching their category semantics.
3. **Clean SVG Search Field**: Replaced emoji search icons with an accessible SVG search icon and clear-field button.
4. **Deliberate Capacity Treatment**:
   - Upcoming events: Displays remaining seats ("18 spots left (12 of 30 registered)").
   - Full events: Displays "Full (30 of 30 registered)" with amber warning indicator.
   - Past events: Displays "Registration closed (24 attended)" without inviting registration.

### Screen 2: Event Details and Attendee Management
1. **Dominant Typography**: Event title formatted as `h1` at 36 to 48px (`clamp(2rem, 3.5vw, 2.75rem)`), weight 800.
2. **Integrated Meta Strip**: Status badge and local date/time placed directly under the title.
3. **Availability Summary Strip**: Replaced three nested metric cards with a unified summary strip displaying Booked ratio, Remaining seats, and Event status with tabular numerals.
4. **Clean Attendee Roster**: Replaced decorative arbitrary avatars with clean SVG glyphs, monospace attendee IDs, join timestamps, and per-row unregister actions with pending states.
5. **Secondary Host Management**: Host controls ("Edit Event", "Delete Event") styled with subdued secondary appearance so they do not visually compete with registration.

### Screen 3 & 4: Create and Edit Event Forms
1. **Removed Wizard Clutter**: Removed artificial numbered step badges (1, 2, 3) in favor of three clean semantic sections.
2. **Clear Timezone Explanation**: Replaced complex prose with a direct callout explaining that times are entered in the local browser timezone and saved as UTC.
3. **Timestamp Precision Preservation (F07)**: Untouched date inputs preserve the exact original raw UTC timestamp, including seconds and microsecond fractions.
4. **Field-Linked Validation**: Errors linked via `aria-describedby` and `aria-invalid` with high-contrast red styling.

### Screen 5: Dialogs and Exceptional States
1. **Accessible Modal**: Focus containment trap, Escape key listener, and focus restoration to trigger button upon close.
2. **404 Recovery View**: Dedicated error screen with a prominent 404 code and a return action.
3. **Empty States**: Clear descriptions and actions for empty directory and empty search results.

## 3. Dark Mode and Responsive Design

- Both Light and Dark appearances authored using semantic color tokens with WCAG AA compliance (> 4.5:1 text contrast).
- Mobile breakpoint (`max-width: 640px`) ensures all form inputs have a minimum font size of 16px to prevent iOS Safari auto-zoom.
- Fresh browser screenshots captured from the real running application are committed to `docs/screenshots/`:
  - `events.png` and `events-dark.png`
  - `events-mobile.png` and `events-dark-mobile.png`
  - `event-detail.png` and `event-detail-dark.png`
  - `event-detail-mobile.png` and `event-detail-dark-mobile.png`
  - `event-form.png` and `event-form-dark.png`
