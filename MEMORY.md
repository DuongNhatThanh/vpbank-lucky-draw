# System Memory & Context
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## Active Phase & Goal
**Current Task:** Phase 2 Domain Foundation implemented; ready for human review.
**Next Steps:**
1. Review the pure TypeScript domain foundation.
2. After approval, continue to the next scoped phase without adding persistence, imports, presentation, reels, or audio until explicitly requested.

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

## Known Issues & Quirks
*(Log current bugs or weird workarounds here)*
- React scaffold and pure domain foundation exist; participant import, persistence/recovery, presentation UI, reels, audio, fullscreen, and XLSX support are not implemented yet.
- In this Codex sandbox, Vitest/Vite config loading can fail with an esbuild parent-directory `Access is denied` error; rerunning `npm run test` or `npm run build` with approved unsandboxed execution passed.
- Exact XLSX package/version is still TBD; default candidate is a stable pinned browser-compatible SheetJS `xlsx` package.
- Exact Vercel URL/domain, sound default state, reel/countdown timing, and default participant filename details will be finalized during implementation/rehearsal.

## Completed Phases
- [x] Deep Research
- [x] PRD
- [x] Technical Design
- [x] Agent instruction files
- [x] Initial scaffold
- [x] Domain model and draw engine
- [ ] Participant import and validation
- [ ] Persistence and recovery
- [ ] Presentation mode
- [ ] Rehearsal and launch
