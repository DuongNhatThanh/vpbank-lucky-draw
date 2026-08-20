# System Memory & Context
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## Active Phase & Goal
**Current Task:** Phase 4 Persistence & Recovery implemented; ready for human review.
**Next Steps:**
1. Review the pure TypeScript persistence and recovery layer.
2. After approval, continue to the next scoped phase without adding imports, presentation, reels, or audio until explicitly requested.

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

## Known Issues & Quirks
*(Log current bugs or weird workarounds here)*
- React scaffold and pure domain foundation exist; participant import, persistence/recovery, presentation UI, reels, audio, fullscreen, and XLSX support are not implemented yet.
- Event state machine exists; participant import, persistence/recovery, presentation UI, reels, audio, fullscreen, and XLSX support are still not implemented yet.
- In this Codex sandbox, Vitest/Vite config loading can fail with an esbuild parent-directory `Access is denied` error; rerunning `npm run test` or `npm run build` with approved unsandboxed execution passed.
- Phase 2 Domain Foundation is approved.
- Phase 3 Event State Machine is approved.
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
- [ ] Participant import and validation
- [ ] Presentation mode
- [ ] Rehearsal and launch
