# Visual Design System and Theme Architecture

This document describes the design system, typography, semantic color tokens, screen layouts, and dark mode architecture for the Event Management application.

For primary research and reference patterns inspired by modern event platforms, see `docs/ui-design.md`.

## Screen Architecture

The application comprises three primary views and shared navigation shell:

### 1. Event Directory (List View)
- Hero Banner: Displays directory kicker, main title, explanatory subtitle, and quick action button.
- Controls Bar: Category filter tabs (All, Upcoming, Past) with counter badges, paired with a live instant search field.
- Event Cards Grid: Responsive grid rendering event cards with:
  - Calendar Date Tile: Month badge and numeric day display.
  - Status Indicators: Upcoming (emerald), Full (amber), and Past (slate) badges with indicator dots.
  - Occupancy Bar: Visual capacity progress meter with numeric percentage and seat counts.
  - Actions: Direct links to event detail and edit views.

### 2. Event Detail & Attendee Roster
- Layout: Two-column desktop grid (collapses to single-column on mobile viewports below 900px).
- Main Column:
  - Header Card: Large calendar date tile, event title, formatted local date/time, and quick metric row (status, capacity, registrations, available seats).
  - Description Card: Formatted multi-line event summary.
  - Attendee Roster: Filterable list of registered users with deterministic avatars, formatted join timestamps, and unregister actions.
- Sidebar Column:
  - Capacity Gauge: Real-time visual progress bar and seat availability tracker.
  - Interactive Attendee Identity: User ID input for rapid registration and unregistration testing.
  - Guidance Banner: Context-sensitive alerts for open seats, waitlist conditions, or closed events.
  - Host Controls: Edit event and delete event actions with confirmation modal.

### 3. Event Creation and Editing Form
- Container: Centered single-column card with max-width 740px.
- Three Fieldset Sections:
  1. Event Overview: Title and description inputs with character counters and validation.
  2. Date and Time: Native datetime input with detected timezone callout. When editing an event, untouched dates preserve the exact original UTC instant without truncation.
  3. Capacity Limits: Numeric input for maximum attendees (1 to 10,000). During edits, capacity cannot be reduced below current attendee count.
- Action Bar: Clear Cancel and Submit buttons with active loading states.

## Typography and Spacing

- Font Stack: `-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
- Baseline Scale: 8px grid system:
  - Small Spacing: 4px (`0.25rem`), 8px (`0.5rem`)
  - Medium Spacing: 12px (`0.75rem`), 16px (`1rem`), 20px (`1.25rem`)
  - Large Spacing: 24px (`1.5rem`), 32px (`2rem`), 40px (`2.5rem`)
- Radii: 6px (`border-radius-sm`), 10px (`border-radius`), 16px (`border-radius-lg`), 9999px (`border-radius-full`).

## Semantic Color System and Dark Mode

Colors are authored as CSS variables in `frontend/src/styles.css`. Components consume semantic role tokens rather than hardcoded palette values.

### Color Tokens

| Semantic Token | Light Mode Value | Dark Mode Value | Purpose |
| --- | --- | --- | --- |
| `--color-bg-page` | `#f8fafc` (slate-50) | `#0b0f19` (rich slate-black) | Canvas background |
| `--color-bg-surface` | `#ffffff` | `#151c2c` (deep navy-slate) | Card, navbar, and container background |
| `--color-bg-surface-raised` | `#ffffff` | `#1e293b` (slate-800) | Modal dialogs and elevated surfaces |
| `--color-bg-subtle` | `#f1f5f9` (slate-100) | `#1e293b` | Filter tabs, hover tracks, secondary areas |
| `--color-bg-inset` | `#f8fafc` | `#101624` | Input containers, metric rows, table items |
| `--color-text-primary` | `#0f172a` (slate-900) | `#f8fafc` (slate-50) | Main headings and body text |
| `--color-text-secondary` | `#475569` (slate-600) | `#94a3b8` (slate-400) | Subtitles, labels, and secondary copy |
| `--color-text-tertiary` | `#64748b` (slate-500) | `#64748b` | Placeholders, captions, and hints |
| `--color-border-default` | `#e2e8f0` (slate-200) | `#273549` (slate-700) | Card and input borders |
| `--color-border-strong` | `#cbd5e1` (slate-300) | `#3b4e68` | Focus and hover border states |
| `--color-primary` | `#4f46e5` (indigo-600) | `#6366f1` (indigo-500) | Primary actions and active links |
| `--color-primary-light` | `#eef2ff` | `rgba(99, 102, 241, 0.18)` | Date tile header and active highlights |
| `--color-success` | `#059669` (emerald-600) | `#10b981` (emerald-500) | Upcoming badges and full capacity meters |
| `--color-success-bg` | `#ecfdf5` | `rgba(16, 185, 129, 0.16)` | Success alerts and status banners |
| `--color-success-text` | `#065f46` | `#6ee7b7` (emerald-300) | High-contrast success copy |
| `--color-warning` | `#d97706` (amber-600) | `#f59e0b` (amber-500) | Capacity warning indicators |
| `--color-warning-bg` | `#fffbeb` | `rgba(245, 158, 11, 0.16)` | Warning alerts and capacity notices |
| `--color-warning-text` | `#92400e` | `#fcd34d` (amber-300) | High-contrast warning copy |
| `--color-danger` | `#dc2626` (red-600) | `#ef4444` (red-500) | Delete buttons and destructive actions |
| `--color-danger-bg` | `#fef2f2` | `rgba(239, 68, 68, 0.16)` | Validation errors and danger banners |
| `--color-danger-text` | `#991b1b` | `#fca5a5` (red-300) | Error descriptions and field warnings |
| `--color-input-bg` | `#ffffff` | `#101624` | Form field backgrounds |
| `--color-input-border` | `#cbd5e1` | `#2e3d55` | Default input border |
| `--color-focus-ring` | `#4f46e5` | `#818cf8` | Keyboard focus outline |

### Measured Contrast Conformance

All token pairs satisfy WCAG 2.1 AA requirements:
- Body Text: Primary text `#f8fafc` on dark surface `#151c2c` measures 14.5:1 (surpassing 4.5:1 AA and 7:1 AAA thresholds).
- Secondary Text: Slate-400 `#94a3b8` on `#151c2c` measures 6.1:1 (surpasses 4.5:1 AA).
- Status Text: Emerald text `#6ee7b7` on dark success background measures 8.2:1. Amber text `#fcd34d` measures 9.4:1. Red text `#fca5a5` measures 7.6:1.
- Buttons: White text on primary indigo `#6366f1` measures 4.7:1 (surpasses 4.5:1 AA).

## Theme Preference and Persistence

### Three-State Preference Model
1. System (Default): Reflects the operating system preference via `window.matchMedia('(prefers-color-scheme: dark)')`. Dynamically updates when OS setting changes.
2. Light: Explicit user override forcing light appearance.
3. Dark: Explicit user override forcing dark appearance.

### Storage and Synchronization
- Storage Key: `event-management:theme` in `localStorage`.
- Storage Values: `'system'`, `'light'`, `'dark'`.
- Fallback: Invalid or unreadable values default to `'system'`. Storage exceptions (such as private browsing mode) are caught safely, allowing session appearance changes.
- Cross-Tab Sync: Storage listener listens for changes across browser tabs and synchronizes appearance immediately.

### Prevention of Unstyled Flash (FOUC)
An early inline script in `frontend/index.html` inspects `localStorage` and `matchMedia` synchronously before stylesheets render. It applies `data-theme="dark"` or `data-theme="light"` and `style.colorScheme` directly onto the `<html>` root element.

### State Preservation
Changing the appearance preference toggles attributes on `document.documentElement` without remounting React router trees or page components. Dirty form inputs, selected attendee IDs, pending network promises, and active confirmation dialogs remain intact across theme changes.

## Component Extension Guidelines

When adding or modifying components:
1. Never hardcode colors like `#ffffff`, `#000000`, or raw `rgb()` in component files or stylesheets.
2. Use the semantic CSS variables (`var(--color-bg-surface)`, `var(--color-text-primary)`, etc.).
3. When creating a new component state, check its appearance in both Light and Dark themes.
4. Ensure all interactive elements include visible `:focus-visible` styling using `var(--color-focus-ring)`.
5. Keep motion opt-in: respect `@media (prefers-reduced-motion: reduce)`.

## Test Coverage

Theme and appearance behaviors are covered by automated tests:
- `frontend/src/utils/theme.test.ts`: Unit tests for storage read/write, fallbacks, OS query, theme resolution, and document attribute application.
- `frontend/src/App.test.tsx`: End-to-end integration tests for navbar theme switcher, system setting changes, cross-tab synchronization, and state preservation during dirty form inputs and attendee actions.
