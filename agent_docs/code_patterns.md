# Code Patterns

## Purpose
This file defines the implementation patterns the agent should follow for this project.
Prefer these patterns over inventing new ones. Fill in each section from the Technical Design document.

## Architecture Pattern
- **Primary pattern:** layered
- **Rule:** Keep domain logic separate from transport/UI concerns.
- **Rule:** Reuse existing modules before creating new abstractions.
- **Rule:** React components may request domain actions, but they must not implement winner selection, eligibility, prize completion, or recovery invariants.

## Data Fetching
- **Primary approach:** direct browser fetches for local static assets only, such as `public/data/participants.json`.
- **Rule:** There is no backend API in the MVP. Do not introduce server calls unless the PRD/Tech Design is revised.
- **Rule:** Keep fetch/import logic in `src/services/`, not inside render functions.

## State Management
- **Server state:** None. There is no backend/server state for the MVP.
- **Client state:** Pure TypeScript domain functions plus one reducer/reducer-like transition boundary; optional React Context only to provide state/actions.
- **Forms:** Controlled React state or simple local component state for setup/import forms; validate through domain/service validators before applying.
- **Rule:** Prefer the simplest working approach for MVP scope. Do not add a state library if React reducer/context is sufficient.

## Error Handling
- Normalize errors at service/domain boundaries - never let raw exceptions reach the UI.
- Never swallow errors silently; always log developer context or return structured details.
- Return user-safe messages in the UI.
- Use a consistent `AppResult<T>`-style shape for operations that can fail.
- Treat sound, fullscreen, confetti, and decorative animation failures as noncritical.
- Treat no eligible participants, invariant violations, persistence failure, and corrupt recovery state as critical.

## Validation
- Validate all external inputs: pasted rows, CSV rows, XLSX rows, default participant data, and persisted localStorage state.
- Preserve four-digit codes exactly, including leading zeros.
- Reject duplicate codes and malformed rows before Apply.
- Recovery must validate storage version, schema version, and state invariants before resuming.
- Keep validation rules co-located with the relevant contract, such as `participantValidation.ts` and `persistence.ts`.

## File and Naming Conventions
- **Files:** camelCase
- **Components / classes:** PascalCase
- **Functions / variables:** camelCase
- **Constants / env vars:** UPPER_SNAKE_CASE
- **Domain modules:** pure TypeScript, no React, DOM, audio, animation, or localStorage imports.
- **Components:** colocate presentation behavior in component folders, but keep business rules in `src/domain/` and `src/state/`.

## Testing Pattern
- Add unit tests for pure logic and utility functions.
- Add integration tests for persistence, recovery, and critical data flows.
- Add Playwright E2E tests for the top P0 live-event journeys.
- Run the test suite after every feature; fix failures before moving on.
- Domain/state changes require tests. Critical user journeys require E2E coverage.

## Change Discipline
- Prefer focused, minimal edits over large rewrites.
- Do not introduce new dependencies without checking the existing stack in `tech_stack.md` first.
- Do not add database migrations, infrastructure config, auth flows, analytics, billing code, or backend APIs without explicit approval.
- One feature at a time - commit or checkpoint after each working feature.
- Stop adding optional polish if it threatens rehearsal readiness before the 2026-08-27 event.
