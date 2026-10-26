# Visual Design System and Theme Architecture

This document describes the design system, typography, semantic color tokens, screen layouts, and dark mode architecture for the Event Management application.

For primary research and reference patterns inspired by modern event platforms, see `docs/ui-design.md`. For the free versus paid and capacity handling audit, see `docs/product-scenario-audit.md`.

## Visual Direction: Confident Editorial Event Workspace

The application employs an editorial event workspace aesthetic:
- Strong typographic hierarchy that makes event names, dates, and availability immediately legible.
- Generous, purposeful vertical rhythm on an 8px baseline.
- Crisp separators and subdued containers that avoid card-on-card visual noise.
- Restrained color accents (deep indigo and violet) paired with deliberate status tints.
- Direct copy ("Events", "Create event", "Register", "Unregister", "Full", "Registration closed") without marketing jargon or ungrounded claims.

## Typography Scale and Hierarchy

The type system is authored in `frontend/src/styles.css` using system fonts with negative letter spacing on headings and tabular numerals for scan-heavy data:

- Font Family: `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Tabular Numbers: `font-variant-numeric: tabular-nums` applied to dates, seat counts, percentages, and metrics.

| Level | Desktop Size | Mobile Size | Weight | Line Height | Letter Spacing | Purpose |
| --- | --- | --- | --- | --- | --- | --- |
| Page Heading `<h1>` | 40 to 56px (`clamp(2rem, 4vw, 3rem)`) | 32 to 38px | 800 | 1.15 | `-0.03em` | Main page title ("Events", "Create New Event") |
| Event Title `<h1>` | 36 to 48px (`clamp(2rem, 3.5vw, 2.75rem)`) | 28 to 34px | 800 | 1.20 | `-0.025em` | Event detail name |
| Card Title `<h2>` | 20 to 24px (`1.25rem`) | 18 to 20px | 700 | 1.35 | `-0.015em` | Directory card headlines |
| Section Title `<h2>` | 18 to 20px (`1.15rem` to `1.25rem`) | 16 to 18px | 700 | 1.30 | `-0.015em` | "About this event", "Registered Attendees" |
| Body & Inputs | 16px (`1rem`) | 16px (`1rem`) | 400/500 | 1.55 | Normal | Descriptions, form inputs (16px avoids iOS auto-zoom) |
| Secondary Copy | 13.5 to 14px (`0.85rem` to `0.875rem`) | 13 to 14px | 500/600 | 1.45 | Normal | Input hints, filter labels, timestamps |
| Captions & Badges | 12 to 12.5px (`0.75rem` to `0.775rem`) | 12px | 700 | 1.00 | `+0.05em` | Uppercase status badges, metric labels |

## Spacing and Rhythm

Built on an 8px baseline rhythm:
- Micro spacing: 4px (`0.25rem`), 8px (`0.5rem`)
- Standard spacing: 12px (`0.75rem`), 16px (`1rem`), 20px (`1.25rem`)
- Component spacing: 24px (`1.5rem`), 32px (`2rem`), 40px (`2.5rem`)
- Corner radii: 6px (`border-radius-sm`), 10px (`border-radius`), 16px (`border-radius-lg`), 9999px (`border-radius-full`).

## Screen Architecture

### Screen 1: Event Directory (`EventListPage.tsx`)
- Header: Bold "Events" heading paired with an understated count ("12 events scheduled") and a primary "Create event" action.
- Control Bar: Unified container housing category tabs ("All", "Upcoming", "Past") with exact counts, paired with an instant search field with an SVG magnifying icon.
- Cards Grid: Clean cards featuring:
  - Calendar Date Tile: Month badge and bold numeric day.
  - Status Indicators: Upcoming (emerald), Full (amber), and Past (slate) badges with indicator dots.
  - Capacity Display: Upcoming events show available seats ("18 spots left (12 of 30 registered)"); full events state "Full (30 of 30 registered)"; past events state "Registration closed (24 attended)" without inviting registration.
  - Actions: Direct "View details" or "View event" primary links and subdued "Edit" secondary actions.

### Screen 2: Event Detail & Attendee Roster (`EventDetailPage.tsx`)
- Layout: Two-column desktop grid collapsing to a stacked single-column layout on viewports under 900px.
- Main Column:
  - Header Card: Meta strip (status badge, local date/time) directly above a bold event title (`h1`).
  - Availability Summary Strip: Replaces fragmented metric cards with a unified three-metric bar (Booked ratio, Remaining seats, Status).
  - Event Description: High-contrast prose with pre-wrap formatting.
  - Attendee Roster: Filterable list of registered participants displaying monospace attendee IDs, registration timestamps, and per-row "Unregister" actions with active pending states.
- Sidebar Column:
  - Registration Panel: Seat gauge bar, Attendee ID input, and context-sensitive Register / Unregister buttons with instant validation feedback.
  - Contextual Status Guidance: Clear guidance cards for registered, full, closed, and open states.
  - Host Controls: Subdued container with "Edit Event" and "Delete Event" actions separated from attendee registration.

### Screen 3 & 4: Create and Edit Event Forms (`EventForm.tsx`, `EventFormPage.tsx`)
- Layout: Centered editorial card (max-width 760px).
- Three Logical Sections:
  1. Basic Information: Event title (required, max 120 chars) and description (optional, max 2,000 chars) with live character counters.
  2. Date, Time & Timezone: Native datetime input with detected local timezone callout explaining automatic UTC conversion. F07 timestamp precision preservation keeps exact raw seconds and fractions untouched when only other fields change.
  3. Capacity & Reservation Limits: Bounded integer input (1 to 10,000). During edits, clear helper text notes that capacity cannot be reduced below current attendee count.
- Action Bar: Clear Cancel and verb-first Submit buttons ("Create Event" or "Save Changes") with disabled pending states.

### Screen 5: Dialogs and Exceptional States
- Delete Confirmation Modal: Accessible dialog (`role="dialog"`, `aria-modal="true"`) with Escape key dismissal, tab focus containment, and focus restoration to the trigger button upon close.
- 404 Recovery View: Prominent 404 glyph, clear explanation, and a direct "Return to Events" action.
- Empty States: Actionable empty directory and empty search results with clear reset buttons.
- Error & Loading States: High-contrast error banners with retry triggers and accessible loading spinners.

## Semantic Color System and Dark Mode

Colors are authored as CSS custom properties in `frontend/src/styles.css`. Components consume semantic role tokens rather than raw palette colors.

| Semantic Token | Light Mode Value | Dark Mode Value | Purpose |
| --- | --- | --- | --- |
| `--color-bg-page` | `#f8fafc` | `#090d16` | Main canvas background |
| `--color-bg-surface` | `#ffffff` | `#131926` | Card, navbar, and container background |
| `--color-bg-surface-raised` | `#ffffff` | `#182032` | Modal dialogs and elevated cards |
| `--color-bg-subtle` | `#f1f5f9` | `#1e293b` | Filter tabs, hover tracks, secondary areas |
| `--color-bg-inset` | `#f8fafc` | `#0e1420` | Input containers, metric rows, table items |
| `--color-text-primary` | `#0f172a` | `#f8fafc` | Headings and primary copy |
| `--color-text-secondary` | `#475569` | `#94a3b8` | Subtitles, labels, secondary copy |
| `--color-text-tertiary` | `#64748b` | `#64748b` | Captions, hints, disabled labels |
| `--color-border-default` | `#e2e8f0` | `#273549` | Card and component borders |
| `--color-border-strong` | `#cbd5e1` | `#3b4e68` | Hover and active border states |
| `--color-primary` | `#4f46e5` | `#6366f1` | Primary actions and brand highlights |
| `--color-primary-light` | `#eef2ff` | `rgba(99, 102, 241, 0.18)` | Date tile header and active highlights |
| `--color-success` | `#059669` | `#10b981` | Upcoming badges and availability meters |
| `--color-warning` | `#d97706` | `#f59e0b` | Full capacity indicators |
| `--color-danger` | `#dc2626` | `#ef4444` | Destructive actions and error states |

## Theme Preference and Persistence

### Three-State Preference Model
1. System (Default): Reflects the operating system setting via `window.matchMedia('(prefers-color-scheme: dark)')`. Dynamically updates when OS setting changes.
2. Light: Explicit user override forcing light appearance.
3. Dark: Explicit user override forcing dark appearance.

### Storage and Synchronization
- Storage Key: `event-management:theme` in `localStorage`.
- Storage Values: `'system'`, `'light'`, `'dark'`.
- URL Parameter Override: Appending `?theme=dark` or `?theme=light` applies the requested appearance for headless automation and testing.
- Cross-Tab Synchronization: Storage events sync theme changes across active browser tabs without remounting page components or resetting form state.
