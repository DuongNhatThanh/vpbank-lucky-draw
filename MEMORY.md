# System Memory & Context
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## Active Phase & Goal
**Current Task:** Phase 6A Application State & Recovery Wiring implemented; awaiting human review.
**Next Steps:**
1. Review the pure TypeScript application state, recovery wiring, selectors, and orchestration layer.
2. After approval, continue to the next scoped phase without adding React UI, XLSX dependency, presentation, reels, or audio until explicitly requested.

## Architectural Decisions
*(Log specific choices made during the build here so future agents respect them)*
- 2026-08-19 - Chosen stack is React + TypeScript + Vite because Codex will write most code, TypeScript reduces state/data mistakes, and Vite can deploy as a static hosted app.
- 2026-08-19 - No backend and no database for MVP; recovery uses versioned localStorage for the one-device hosted event workflow.
- 2026-08-19 - Official winner selection must use `crypto.getRandomValues()` with rejection sampling; `Math.random()` is forbidden for draw results.
- 2026-08-19 - UI and animation are adapters only. Eligibility, winner lifecycle, prize progression, and invariants belong in pure TypeScript domain/state modules.
- 2026-08-19 - Codex is the confirmed primary AI coding tool; `AGENTS.md` is the canonical project instruction file.
- 2026-08-19 - Phase 2 Domain Foundation added `src/domain/types.ts`, `src/domain/eligibility.ts`, `src/domain/drawEngine.ts`, and `src/domain/invariants.ts`.
- 2026-08-19 - Draw selection currently returns an `AppResult<Participant>` from the eligible pool only; it does not mutate participants, create attempts, persist state, or trigger UI/animation.
- 2026-08-19 - Domain invariant validation returns structured error codes for inspectable tests and future recovery handling; it does not silently repair invalid state.
- 2026-08-19 - Phase 3 Event State Machine added `src/domain/eventMachine.ts` with pure command-driven transitions for setup, countdown, draw, reel stopping, pending winner, confirm, absent, and prize advancement.
- 2026-08-19 - Event state transitions validate incoming and outgoing state with `validateEventStateInvariants(...)` and keep selection injectable for tests while defaulting to `drawEngine`.
- 2026-08-19 - Phase 4 Persistence & Recovery added `src/services/persistence.ts` with canonical key `vpbank-lucky-draw:event-state`, storage version `1`, and schema version `1`.
- 2026-08-19 - Persistence uses runtime parsing plus invariant validation before load/save; invalid persisted state is rejected without silent repair.
- 2026-08-20 - Phase 5 Participant Import & Validation added typed default participant data in `src/data/defaultParticipants.ts`; no runtime fetch is used for the default roster.
- 2026-08-20 - Participant identity for the MVP is the four-digit lucky number; names are optional metadata only. Number-only rosters are valid, and validation normalizes external rows into four-digit code plus optional trimmed name metadata, preserves leading zeros and Vietnamese text, reports invalid/duplicate rows, and applies valid lists all-or-nothing only to pristine setup state.
- 2026-08-20 - Paste and CSV import share the same `RawParticipantRow` contract so a future XLSX adapter can feed validation without adding the XLSX dependency yet.
- 2026-08-20 - Phase 5 hardening rejects empty participant rosters and validates the candidate `EventState` with domain invariants before Apply succeeds; the Tech Design default roster path is aligned with `src/data/defaultParticipants.ts`.
- 2026-08-20 - Phase 6A added `src/state/actions.ts`, `src/state/initialState.ts`, `src/state/appReducer.ts`, `src/state/selectors.ts`, and `src/state/appController.ts`; the application layer only orchestrates startup inspection, participant preview/apply, resume, and start-new flows around the existing domain and persistence services.
- 2026-08-20 - Participant apply now persists the candidate event state before the app commits it, and startup/recovery never auto-resumes without an explicit action.
- 2026-08-20 - Phase 6A hardening clarified that `configurationLocked` prevents setup edits only; it does not block starting Prize 2..6 when the event is in a valid `ready` state.

## Known Issues & Quirks
*(Log current bugs or weird workarounds here)*
- React scaffold, pure domain foundation, event state machine, persistence/recovery, participant import/validation, and Phase 6A application state wiring exist; presentation UI, reels, audio, fullscreen, and XLSX parser support are not implemented yet.
- In this Codex sandbox, Vitest/Vite config loading can fail with an esbuild parent-directory `Access is denied` error; rerunning `npm run test` or `npm run build` with approved unsandboxed execution passed.
- Phase 2 Domain Foundation is approved.
- Phase 3 Event State Machine is approved.
- Phase 4 Persistence & Recovery is approved.
- Phase 5 Participant Import & Validation is approved.
- Exact XLSX package/version is still TBD; default candidate is a stable pinned browser-compatible SheetJS `xlsx` package.
- Exact Vercel URL/domain, sound default state, reel/countdown timing, and default participant filename details will be finalized during implementation/rehearsal.

## Completed Phases
- [x] Deep Research
- [x] PRD
- [x] Technical Design
- [x] Agent instruction files
- [x] Initial scaffold
- [x] Domain model and draw engine
- [x] Event state machine
- [x] Persistence and recovery
- [x] Participant import and validation (approved)
- [ ] Presentation mode
- [ ] Rehearsal and launch
