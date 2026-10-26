---
name: event-management-quality
description: Verification, review, and regression hardening workflows for the Event Management application. Use when verifying event or registration changes, validating concurrency rules, auditing dark mode appearance, or updating scenario coverage evidence.
---

# Event Management Quality and Verification Workflow

This repository-local skill guides coding agents through repeatable verification and regression audits for the Event Management assessment project.

## Purpose

Use this workflow whenever modifying backend business rules, concurrency handling, frontend components, or appearance themes. It ensures changes satisfy all assessment requirements without regressing previous hardening fixes (F01 through F12).

## Essential Invariants to Check

Before writing or modifying tests, verify these core constraints:
1. Concurrency: State modifications must hold the repository lock throughout capacity and duplicate checks until mutation is complete.
2. Clock Invariant: Event `upcoming` vs `past` status must evaluate dynamically against UTC now.
3. Timestamp Preservation: Editing an event with an untouched datetime input must preserve the exact ISO UTC string without seconds truncation.
4. Identity Normalization: Attendee IDs must be trimmed and case-folded to lowercase before lookup or storage.
5. Appearance Independence: Theme changes must never remount page components, clear dirty form fields, or disrupt in-flight network requests.

## Verification Steps

### Step 1: Run Reusable Verification Script

From the repository root, run the bundled verification script:
```bash
./.agents/skills/event-management-quality/scripts/verify_quality.sh
```

This runs:
1. Backend pytest suite (`backend/`)
2. Backend Ruff lint and format checks (`backend/`)
3. Frontend Vitest suite (`frontend/`)
4. Frontend TypeScript compilation (`npm run typecheck`)
5. Frontend ESLint checks (`npm run lint`)
6. Frontend production build (`npm run build`)

If any check fails, the script exits immediately with a non-zero code.

### Step 2: Concurrency and Isolation Verification

When modifying repository locking or state access:
1. Run backend tests with both demo seeding states:
   ```bash
   cd backend
   SEED_DEMO_DATA=false pytest -q
   SEED_DEMO_DATA=true pytest -q
   ```
2. Verify test isolation: no test should depend on order or leave residue in the in-memory store.
3. Run the high-concurrency race test:
   ```bash
   pytest tests/test_concurrency.py -q
   ```

### Step 3: Frontend Appearance and State Preservation

When modifying UI components or styling:
1. Verify both Light and Dark themes satisfy WCAG AA contrast (minimum 4.5:1 for body copy).
2. Check that all new UI components reference semantic tokens in `frontend/src/styles.css` rather than hardcoded hex or RGB values.
3. Run theme unit and integration tests:
   ```bash
   cd frontend
   npm test -- src/utils/theme.test.ts src/App.test.tsx
   ```
4. Verify that toggling appearance between System, Light, and Dark preserves dirty form state and active modal dialogs.

### Step 4: Update Documentation and Evidence

1. If a new defect was resolved, log root causes and regression test names in `docs/review-findings.md`.
2. Update the scenario matrix in `docs/scenario-coverage.md` with:
   - Scenario description and risk level.
   - Exact automated test file and test function name.
   - Expected outcome and actual result.
3. Record architectural decisions or trade-offs in `docs/decisions.md`.

## Completion Criteria

The quality review is complete only when:
- All backend tests pass (`68 passed` or more).
- Backend Ruff lint and formatting report 0 errors.
- All frontend tests pass (`52 passed` or more).
- Frontend typecheck, lint, and build execute with exit code 0.
- `docs/scenario-coverage.md` reflects current test proof.
