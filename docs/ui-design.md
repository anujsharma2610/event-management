# UI Design & Redesign Documentation (Mobbin References)

This document records the UI design improvements made to the Event Management application using real product patterns from Mobbin, following the Mobbin redesign workflows and guidelines.

---

## 1. Verified Mobbin References

### Screen 1: Event List
- **Luma (Web)**: [https://mobbin.com/screens/01732b58-0dc7-4c31-9965-6002f42611fa](https://mobbin.com/screens/01732b58-0dc7-4c31-9965-6002f42611fa)  
  *Anchor*: Calendar date tile badge (separated month and day block), status pill badges, interactive card hover lift, and tabbed view filter (All / Upcoming / Past).
- **Eventbrite (Web)**: [https://mobbin.com/screens/f5ad607c-4b0e-4f66-95cc-a0deb5c6a515](https://mobbin.com/screens/f5ad607c-4b0e-4f66-95cc-a0deb5c6a515)  
  *Pool*: Capacity progress bars, compact metadata chips, and distinct visual treatment for sold-out/full events.
- **Cal.com (Web)**: [https://mobbin.com/screens/f2d9ff95-23a4-4827-8233-9d0789e0091c](https://mobbin.com/screens/f2d9ff95-23a4-4827-8233-9d0789e0091c)  
  *Pool*: Clean dashboard header layout with quick-action creation button and friendly, high-contrast empty state.

### Screen 2: Event Details & Attendee Registration
- **Luma (Web)**: [https://mobbin.com/screens/9164be72-b82e-4934-98b4-d8dd4089b829](https://mobbin.com/screens/9164be72-b82e-4934-98b4-d8dd4089b829)  
  *Anchor*: Two-column desktop layout. The main column houses the event title, banner, detailed description, and attendee roster with avatar badges. The right column houses a sticky registration card with live capacity gauge, prominent CTA, and attendee identity switcher.
- **Partiful (Web)**: [https://mobbin.com/screens/41856487-20b4-4361-b7b4-da8b90fe858c](https://mobbin.com/screens/41856487-20b4-4361-b7b4-da8b90fe858c)  
  *Pool*: Distinct current-user RSVP card ("You are registered") with quick unregister button, and search/filter across attendee list.
- **Eventbrite (Web)**: [https://mobbin.com/screens/4c3936dd-af6e-4075-8b88-9f5c3d275cba](https://mobbin.com/screens/4c3936dd-af6e-4075-8b88-9f5c3d275cba)  
  *Pool*: Attendee list table with registration timestamps, badges, and inline actions.

### Screen 3: Create & Edit Event Form
- **Eventbrite (Web)**: [https://mobbin.com/screens/593564c3-518f-4ceb-a45c-72eb118df221](https://mobbin.com/screens/593564c3-518f-4ceb-a45c-72eb118df221)  
  *Anchor*: Grouped fieldset cards ("Event Overview", "Date & Time", "Capacity & Limits"), clear field labels with descriptive hints, character counters, and sticky action bar.
- **Circle (Web)**: [https://mobbin.com/screens/62129f63-805a-4c88-8d8c-3feedd4ea8f7](https://mobbin.com/screens/62129f63-805a-4c88-8d8c-3feedd4ea8f7)  
  *Pool*: Timezone badge with globe icon and explicit local wall-clock explanation.
- **Luma (Web)**: [https://mobbin.com/screens/df1187a5-4d7d-4db3-ace0-23c3efc89dde](https://mobbin.com/screens/df1187a5-4d7d-4db3-ace0-23c3efc89dde)  
  *Pool*: Subtle card elevation, clean input focus rings, and inline feedback on validation errors.

---

## 2. Design Decisions & Planned Enhancements

### Screen 1: Event List Improvements
1. **Calendar Date Badge**: Replace inline emoji text with a structured date tile (month abbreviation in header, bold day number) inspired by Luma.
2. **Category / Status Tabs**: Add filter tabs ("All Events", "Upcoming", "Past") so users can quickly filter without extra API calls.
3. **Capacity Visual Meter**: Add a visual progress bar indicating occupancy percentage (green for available, amber for >80% or full).
4. **Improved Card Hierarchy**: Stronger typography with Inter font stack, subtle border transitions, and prominent action buttons.

### Screen 2: Event Details & Attendee Registration Improvements
1. **Two-Column Responsive Layout**: Split event details into an informative left column (metadata, full description, attendee roster) and an action-oriented right sidebar card for registration and live capacity gauge, matching Luma's pattern.
2. **Attendee Avatar Generator**: Generate clean initials avatars with deterministic colors based on `userId` to make the attendee roster visual and engaging.
3. **Capacity Gauge**: Visual progress bar showing exact remaining spots and percentage filled.
4. **Registration Status Card**: High-contrast, state-specific visual feedback (Registered card with green ring, Full capacity banner with warning ring, Past event banner).
5. **Attendee Filter**: Filter attendees in real-time as the roster grows.

### Screen 3: Create/Edit Event Form Improvements
1. **Sectioned Form Groups**: Group inputs into clean logical sections ("General Details", "Date, Time & Timezone", "Capacity Limits").
2. **Timezone Callout Banner**: Dedicated callout box explaining that input is interpreted in the browser timezone and stored in UTC.
3. **Live Character & Capacity Feedback**: Dynamic character count indicator with threshold styling and clear helper text explaining integer constraints (1–10,000).
4. **Enhanced Error Hierarchy**: Both inline field-level alerts and a top summary banner with accessible `role="alert"`.

---

## 3. Accessibility & Usability Preserved
- All standard HTML form labels associated via `htmlFor`.
- Keyboard navigation with visible focus rings (`:focus-visible`).
- Accessible names on all buttons and interactive controls.
- Color contrast compliant with WCAG AA minimums (slate-800 text on white, emerald-700 on emerald-50, etc.).
- Responsive breakpoints tested at mobile (375px), tablet (768px), and desktop (1280px).
