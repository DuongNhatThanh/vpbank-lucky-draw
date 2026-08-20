# System Memory & Context
<!--
AGENTS: Update this file after every major milestone, structural change, or resolved bug.
DO NOT delete historical context if it is still relevant. Compress older completed items.
-->

## Active Phase & Goal
**Current Task:** Phase 10A Single-Screen MC Live Experience implemented; awaiting human review.
**Next Steps:**
1. Review the Presentation Mode MC controls in rehearsal and confirm the full live flow can run without returning to Operator Mode.
2. After Phase 10A approval, continue to Phase 10B/10C visual/audio choreography without changing draw correctness or persistence architecture.

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
- 2026-08-20 - Phase 6B added an operator setup UI shell that drives startup recovery, default roster load, paste/CSV participant preview, explicit apply, six-prize review, and prepare-for-live-draw wiring without implementing presentation mode.
- 2026-08-20 - Phase 7 added the live operator application flow: setup routes into a live operator screen after preparation, recovery resumes directly into the saved live phase, and every live transition persists the candidate `EventState` before committing it to React state.
- 2026-08-20 - Phase 8A added a UI-local `viewMode` toggle between operator and presentation screens; the audience presentation never selects or mutates winners and only renders persisted event state.
- 2026-08-20 - Reel animation is driven entirely from the saved `reelStopping` / `pendingWinner` state, so refresh or resume replays the same official winning code instead of generating a new result.
- 2026-08-20 - Reel stopping now delegates reveal completion to the existing App controller after the fourth digit settles, with an attempt-keyed exactly-once guard that also covers remounts and reduced-motion timing.
- 2026-08-20 - Presentation `prizeComplete` renders the confirmed winner for the current prize, while ready/drawing use neutral reels and countdown uses a 3-2-1 visual.
- 2026-08-20 - Phase 8A Presentation Mode + Reel System approved; Phase 8B adds UI-local fullscreen, non-blocking presentation audio, bounded celebration effects, and final event polish without changing EventState.
- 2026-08-20 - Phase 9 rehearsal and launch-readiness documentation was added. The supplied local audio assets match the configured paths, and the remaining venue, fullscreen, audio, Vercel, offline, and browser-refresh checks require human rehearsal.
- 2026-08-20 - Presentation audio uses shipped local asset paths under `/audio/`; missing assets or rejected playback never block the draw, and reduced motion replaces moving confetti with a static glow.
- 2026-08-20 - Phase 9 automated readiness checks are approved.
- 2026-08-20 - Phase 10A adds phase-aware MC controls directly to Presentation Mode by reusing the existing App live handlers and appController transitions; Presentation still never performs RNG or mutates draw state directly.
- 2026-08-20 - Operator Mode remains the fallback/admin/recovery interface, while the normal MC live flow can run from Presentation Mode after opening it once.
- 2026-08-20 - Phase 10B/10C visual/audio choreography is not implemented yet; reel timing, continuous spin audio, digit-stop audio choreography, gold winner animation, scale-up, and fireworks redesign remain deferred.

## Known Issues & Quirks
*(Log current bugs or weird workarounds here)*
- React scaffold, pure domain foundation, event state machine, persistence/recovery, participant import/validation, Phase 6A application state wiring, Phase 6B operator setup UI, Phase 7 live operator flow, and Phase 8A/8B presentation polish exist; XLSX parser support remains intentionally deferred.
- In this Codex sandbox, Vitest/Vite config loading can fail with an esbuild parent-directory `Access is denied` error; rerunning `npm run test` or `npm run build` with approved unsandboxed execution passed.
- Phase 2 Domain Foundation is approved.
- Phase 3 Event State Machine is approved.
- Phase 4 Persistence & Recovery is approved.
- Phase 5 Participant Import & Validation is approved.
- Phase 6A Application State & Recovery Wiring is approved.
- Phase 6B Operator Setup UI is approved.
- Phase 7 Live Operator Flow is approved.
- Phase 8A Presentation Mode + Reel System is approved.
- Phase 8B Fullscreen + Audio + Confetti + Final Event Polish is approved.
- Phase 9 Rehearsal & Launch Readiness automated checks are approved; venue/human rehearsal is still required.
- Phase 10A Single-Screen MC Live Experience is implemented and awaiting human review.
- Presentation mode now uses the available VPBank logo asset from `public/vpbank-logo.webp`.
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
- [x] Live operator flow (approved)
- [x] Presentation mode and reels (approved)
- [x] Fullscreen, audio, confetti, and final event polish
- [x] Rehearsal and launch automated readiness
- [ ] Single-screen MC live experience (implemented; awaiting human review)
