# Agent Guidelines for Event Management

This document defines architectural invariants, environment workflows, and change routing for automated coding agents working in this repository.

## Repository Overview

```text
event-management/
├── backend/                  FastAPI REST application (Python 3.14+, Pydantic v2)
│   ├── app/                  API routes, models, schemas, and in-memory store
│   └── tests/                Pytest suite covering business rules and concurrency
├── frontend/                 React 19 single-page application (TypeScript, Vite)
│   ├── src/                  Pages, components, API client, and theme utils
│   └── index.html            Vite entry point with inline appearance bootstrap
├── docs/                     Architecture decisions, review findings, scenario coverage
└── .agents/skills/           Repository-local verification and quality skills
```

## Environment and Commands

Always run commands from their respective subdirectories.

### Backend (`backend/`)

- Setup virtual environment:
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
  ```
- Run development server (single worker required):
  ```bash
  source .venv/bin/activate
  uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
  ```
- Run tests:
  ```bash
  source .venv/bin/activate
  pytest -q
  ```
- Lint and format check:
  ```bash
  source .venv/bin/activate
  ruff check .
  ruff format --check .
  ```

### Frontend (`frontend/`)

- Setup dependencies:
  ```bash
  npm install
  ```
- Run development server:
  ```bash
  npm run dev
  ```
- Run test suite:
  ```bash
  npm test
  ```
- Typecheck, lint, and build:
  ```bash
  npm run typecheck
  npm run lint
  npm run build
  ```

## Non-Negotiable Invariants

Any agent making modifications must preserve these fundamental architectural invariants:

1. Single Worker Process:
   State resides in memory inside the running Python process. The server must run with exactly one worker (`--workers 1`). Running multiple worker processes partitions state.
2. Complete Atomic Locking:
   All operations that check capacity or duplicates before mutating state must hold the repository lock for the entire read-check-mutate cycle. Never release the lock between reading remaining capacity and appending a registrant.
3. Volatile In-Memory Storage:
   Backend data resets on process restart. Demo data seeds automatically when `SEED_DEMO_DATA=true`. Test fixtures must explicitly set `seed_demo=False` to maintain isolation.
4. Injectable UTC Time:
   All timestamps are stored and evaluated in UTC. Event status (`upcoming` vs `past`) depends on whether event date is strictly after `now()`. The store accepts an optional `now_fn` clock callback for deterministic testing.
5. Identity Normalization:
   Attendee `userId` values must be trimmed of leading/trailing whitespace and normalized to lowercase before registration lookup or insertion.
6. Registration Rules:
   - Duplicate registrations for the same user on the same event return HTTP 400.
   - Registrations on full events return HTTP 400.
   - Registrations on past events return HTTP 400.
   - Unregistering a non-existent registrant returns HTTP 404.
7. Defensive Copying:
   Queries must return defensive copies of event dictionaries and attendee lists to prevent caller mutations from polluting internal store state.
8. Full PUT Semantics:
   Updating an event via `PUT /api/events/{id}` replaces title, description, date, and max capacity. A capacity reduction below the existing registration count must be rejected with HTTP 400.
9. Theme Preference and Appearance:
   The UI supports three preferences: System, Light, and Dark. Appearance preference persists in `localStorage` under `event-management:theme`. Business data remains solely in backend memory. Switching appearance must never remount pages or discard dirty form inputs.

## Change Routing Guide

Consult these documents before modifying specific project areas:

- Backend API and Business Rules:
  Read `docs/decisions.md` and check `backend/tests/`. Record any breaking contract changes in `docs/decisions.md`.
- Frontend Design and Theme System:
  Read `DESIGN.md`. All UI colors must use semantic CSS tokens defined in `frontend/src/styles.css`.
- Review Findings and Hardening:
  Read `docs/review-findings.md` and `docs/scenario-coverage.md`. Update corresponding test entries for any resolved issue.
- Quality Verification:
  Follow the local skill instructions at `.agents/skills/event-management-quality/SKILL.md`.

## Quality Evidence Requirements

Before submitting code changes, execute and verify:
1. Backend test suite (`pytest -q`) and linter (`ruff check .`).
2. Frontend unit tests (`npm test`), typecheck (`npm run typecheck`), and production build (`npm run build`).
3. Verification that untouched date instants and selected attendee state remain preserved across route transitions and appearance toggles.
4. Update scenario documentation in `docs/scenario-coverage.md`.

External publication or deployment must always follow explicit user instructions. Do not push to remote repositories or publish artifacts without authorization.
