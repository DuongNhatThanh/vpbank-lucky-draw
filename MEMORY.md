# System Memory & Context
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## Active Phase & Goal
**Current Task:** Documentation consistency pass complete; awaiting approval to begin Phase 1 scaffolding.
**Next Steps:**
1. Begin Phase 1 scaffolding only after approval.
2. Add the canonical scripts and baseline tests once the app is scaffolded.

## Architectural Decisions
*(Log specific choices made during the build here so future agents respect them)*
- 2026-08-19 - Chosen stack is React + TypeScript + Vite because Codex will write most code, TypeScript reduces state/data mistakes, and Vite can deploy as a static hosted app.
- 2026-08-19 - No backend and no database for MVP; recovery uses versioned localStorage for the one-device hosted event workflow.
- 2026-08-19 - Official winner selection must use `crypto.getRandomValues()` with rejection sampling; `Math.random()` is forbidden for draw results.
- 2026-08-19 - UI and animation are adapters only. Eligibility, winner lifecycle, prize progression, and invariants belong in pure TypeScript domain/state modules.
- 2026-08-19 - Codex is the confirmed primary AI coding tool; `AGENTS.md` is the canonical project instruction file.

## Known Issues & Quirks
*(Log current bugs or weird workarounds here)*
- No application code has been scaffolded yet.
- Exact XLSX package/version is still TBD; default candidate is a stable pinned browser-compatible SheetJS `xlsx` package.
- Exact Vercel URL/domain, sound default state, reel/countdown timing, and default participant filename details will be finalized during implementation/rehearsal.

## Completed Phases
- [x] Deep Research
- [x] PRD
- [x] Technical Design
- [x] Agent instruction files
- [ ] Initial scaffold
- [ ] Domain model and draw engine
- [ ] Participant import and validation
- [ ] Persistence and recovery
- [ ] Presentation mode
- [ ] Rehearsal and launch
