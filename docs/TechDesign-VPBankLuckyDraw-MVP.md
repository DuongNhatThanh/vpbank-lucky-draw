# Technical Design Document: VPBank Lucky Draw MVP

**Product:** VPBank Lucky Draw  
**Event:** DPC Party H1.2026  
**Version:** 1.0  
**User level:** A — Vibe-coder  
**Primary coding assistant:** Codex  
**Target platform:** Hosted web application  
**Target launch:** Production-ready before 27 August 2026  
**Primary priority:** Correctness and recoverability over animation complexity  
**Status:** Ready for AGENTS.md / implementation planning

---

## 1. Recommended Approach

### Primary recommendation: React + TypeScript + Vite

**Why this fits**
- Codex will write nearly all code.
- TypeScript reduces accidental state/data errors.
- React gives clean component boundaries for Operator and Presentation modes.
- Vite keeps the build simple and deploys cleanly to Vercel.
- Business logic can live in plain TypeScript modules, isolated from UI/animation.
- No backend/database is needed.

### Core stack

| Area | Choice | Why |
|---|---|---|
| UI | React | Clean component boundaries |
| Language | TypeScript | Safer AI-generated changes |
| Build | Vite | Small, fast, simple static build |
| Unit/integration tests | Vitest | Natural fit with Vite |
| E2E | Playwright | Protect critical live-event flows |
| XLSX | Pinned browser-compatible `xlsx` parser | Required by PRD |
| RNG | Web Crypto API | `crypto.getRandomValues()` |
| Persistence | Versioned `localStorage` | Sufficient for one-device recovery |
| Audio | Bundled assets / Web Audio | No runtime service |
| Hosting | Vercel | Git push → HTTPS URL |
| Source control | Git + GitHub | Rollback and deploy integration |
| AI coding | Codex | Confirmed primary tool |

### Alternatives

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Vanilla HTML/CSS/JS | Few dependencies | Easier for state/UI logic to become tangled | Rejected for production architecture |
| React + TS + Vite | Structured, testable, lightweight | More files/concepts | **Chosen** |
| Next.js + TS | Full-stack capabilities | Adds features not needed | Rejected as unnecessary |

---

## 2. Architecture

```text
┌───────────────────────────────────────────────────────────┐
│                     React UI Layer                        │
│                                                           │
│  Operator UI                   Presentation UI            │
│  - Setup                       - Event title              │
│  - Imports                     - Prize                    │
│  - Validation                  - 4 reels                  │
│  - Controls                    - Winner reveal            │
│  - Progress/history            - Grand Prize             │
└────────────────────────┬──────────────────────────────────┘
                         │ commands + view state
                         ▼
┌───────────────────────────────────────────────────────────┐
│                Application / State Layer                  │
│                                                           │
│  setup → ready → countdown → drawing → pending winner    │
│                 → confirm / absent → next prize           │
└───────────────┬───────────────────────┬───────────────────┘
                │                       │
                ▼                       ▼
┌─────────────────────────┐   ┌─────────────────────────────┐
│ Draw Domain             │   │ Persistence                │
│ eligibility             │   │ schema/versioning          │
│ secure random index     │   │ save/restore               │
│ no-repeat rules         │   │ resume/start-new           │
│ prize invariants        │   │ validation                 │
└─────────────────────────┘   └─────────────────────────────┘
```

**Architecture rule:** UI may request domain actions, but UI and animation must never implement winner selection or eligibility rules.

---

## 3. Project Structure

```text
vpbank-lucky-draw/
├── AGENTS.md
├── README.md
├── package.json
├── tsconfig.json
├── vite.config.ts
├── playwright.config.ts
├── index.html
├── docs/
│   ├── research-VPBankLuckyDraw.md
│   ├── PRD-VPBankLuckyDraw-MVP.md
│   ├── TechDesign-VPBankLuckyDraw-MVP.md
│   ├── ui-spec.md
│   └── rehearsal-checklist.md
├── public/
│   ├── data/participants.json
│   ├── images/vpbank-logo.webp
│   └── sounds/
│       ├── countdown.mp3
│       ├── reel-stop.mp3
│       └── winner.mp3
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── domain/
│   │   ├── types.ts
│   │   ├── eventMachine.ts
│   │   ├── drawEngine.ts
│   │   ├── eligibility.ts
│   │   ├── invariants.ts
│   │   └── participantValidation.ts
│   ├── state/
│   │   ├── appReducer.ts
│   │   ├── actions.ts
│   │   ├── selectors.ts
│   │   └── initialState.ts
│   ├── services/
│   │   ├── persistence.ts
│   │   ├── participantImport.ts
│   │   ├── xlsxImport.ts
│   │   ├── audio.ts
│   │   └── fullscreen.ts
│   ├── components/
│   │   ├── operator/
│   │   ├── presentation/
│   │   └── shared/
│   ├── hooks/
│   └── styles/
├── tests/
│   ├── domain/
│   └── e2e/
└── reference/
    ├── v2-claude.html
    └── v3-slot-machine.html
```

---

## 4. Domain Model

```ts
type ParticipantStatus = "eligible" | "pending" | "confirmed" | "absent";

interface Participant {
  id: string;
  code: string;
  name?: string;
  status: ParticipantStatus;
}

interface Prize {
  id: string;
  index: number;
  name: string;
  isGrandPrize: boolean;
}

type AttemptStatus = "pending" | "confirmed" | "absent";

interface DrawAttempt {
  id: string;
  prizeId: string;
  participantId: string;
  status: AttemptStatus;
  createdAt: string;
  resolvedAt?: string;
}

type EventPhase =
  | "setup"
  | "ready"
  | "countdown"
  | "drawing"
  | "reelStopping"
  | "pendingWinner"
  | "prizeComplete"
  | "eventComplete";

interface EventState {
  schemaVersion: number;
  eventName: string;
  phase: EventPhase;
  participants: Participant[];
  prizes: Prize[];
  currentPrizeIndex: number;
  currentAttemptId?: string;
  attempts: DrawAttempt[];
  configurationLocked: boolean;
  soundEnabled: boolean;
  sessionStartedAt?: string;
  updatedAt: string;
}
```

Derived values such as eligible participants, confirmed winners and current prize should be computed with selectors rather than duplicated in state.

---

## 5. State Invariants

These are non-negotiable and must be tested:

1. Exactly six prizes exist.
2. Prize indices stay within `0..5`.
3. At most one pending draw attempt exists.
4. A completed prize has exactly one confirmed winner.
5. Current prize cannot advance while pending.
6. Confirmed participants are never eligible.
7. Absent participants are never eligible.
8. Pending participant cannot be selected again.
9. Animation cannot mutate eligibility.
10. Recovery must revalidate all invariants before resuming.

If recovery data violates an invariant, stop progression and show a safe recovery error.

---

## 6. Event State Machine

```text
SETUP
  └─ APPLY_VALID_CONFIG → READY

READY
  └─ START_DRAW → COUNTDOWN

COUNTDOWN
  └─ COUNTDOWN_COMPLETE → DRAWING

DRAWING
  └─ WINNER_SELECTED_AND_PERSISTED → REEL_STOPPING

REEL_STOPPING
  └─ REVEAL_COMPLETE → PENDING_WINNER

PENDING_WINNER
  ├─ CONFIRM_WINNER → PRIZE_COMPLETE
  └─ MARK_ABSENT → READY (same prize)

PRIZE_COMPLETE
  ├─ NEXT_PRIZE → READY
  └─ last prize confirmed → EVENT_COMPLETE
```

Forbidden examples: `SETUP → DRAWING`, `READY → NEXT_PRIZE`, `PENDING_WINNER → NEXT_PRIZE`, `EVENT_COMPLETE → START_DRAW`.

UI controls must be derived from allowed transitions.

---

## 7. Draw Engine

The draw engine receives valid state and returns one eligible participant.

It must not know about React, DOM, audio, localStorage or animation.

### Secure integer selection

Use `crypto.getRandomValues()` plus rejection sampling:

```text
range = 2^32
limit = floor(range / eligibleCount) * eligibleCount

repeat:
  n = secureUint32()
until n < limit

index = n % eligibleCount
```

### Persist-before-animation

```text
Select participant
      ↓
Create pending attempt
      ↓
Mark participant pending
      ↓
Persist state
      ↓
Start reel animation
```

If the browser refreshes after selection but before reveal finishes, Resume must restore that same pending winner.

---

## 8. Participant Import

Supported sources:
- Default JSON
- Paste/manual text
- CSV
- XLSX

Normalize all sources to:

```ts
interface RawParticipantRow {
  code: unknown;
  name?: unknown;
  sourceRow: number;
}
```

Validation pipeline:

```text
Raw rows
→ trim/normalize
→ validate four digits
→ preserve leading zeros
→ normalize optional name
→ detect duplicates
→ preview report
→ explicit Apply
```

Result:

```ts
interface ParticipantValidationResult {
  received: number;
  valid: Participant[];
  duplicateRows: ValidationIssue[];
  invalidRows: ValidationIssue[];
}
```

### XLSX options

| Option | Pros | Cons | Decision |
|---|---|---|---|
| SheetJS `xlsx` or equivalent stable parser | Browser-side XLSX, common pattern | Adds dependency/bundle size | **Preferred** |
| Require CSV conversion | No XLSX dependency | Violates PRD | Rejected |

Pin the XLSX dependency version before final rehearsals.

---

## 9. Persistence & Recovery

Use a namespaced key such as:

```text
vpbank-lucky-draw:event-state
```

Envelope:

```ts
interface PersistedEnvelope {
  storageVersion: number;
  savedAt: string;
  state: EventState;
}
```

Persist after:
- participant list applied
- prize config applied
- event lock/start
- pending winner created
- winner confirmed
- winner marked absent
- next prize
- reset/new session

Startup:

```text
Read saved envelope
→ validate version/schema
→ validate invariants
→ unfinished valid state?
      yes → Resume / Start New
      no  → normal setup
```

`Start New Session` requires confirmation.

Version initially with `storageVersion = 1`, `schemaVersion = 1`.

---

## 10. React State Strategy

Use:
- Pure domain functions
- One reducer/reducer-like transition boundary
- Optional React Context only to provide state/actions

Avoid:
- Business rules spread across component `useState`
- Animation components owning winner state
- Duplicated current-prize/winner status

Example commands:

```text
APPLY_PARTICIPANTS
START_EVENT
START_DRAW
COUNTDOWN_FINISHED
WINNER_SELECTED
REVEAL_FINISHED
CONFIRM_WINNER
MARK_ABSENT
NEXT_PRIZE
RESET_EVENT
```

---

## 11. Reel Animation

Animation receives an already-selected winning code, e.g.:

```ts
animateWinner("8527")
```

Each reel renders a vertical digit strip and translates it until it lands on its predetermined digit.

Preferred behavior:
- all reels begin spinning
- controlled deceleration
- Reel 1 stops
- Reel 2 stops later
- Reel 3 stops later
- Reel 4 stops last
- final number holds
- Pending Winner state begins

Exact timing belongs in UI tuning, not domain logic.

If animation fails, a fallback must set the final winning code directly after a timeout.

Grand Prize changes visual tokens/timing only, never draw logic.

---

## 12. Audio

MVP sounds:
- countdown
- reel spin
- reel stop
- winner sting

Rules:
- bundled local assets and/or Web Audio
- no remote audio URLs
- Sound On/Off
- initialize after a user gesture
- playback failures are nonfatal
- never await audio before domain transitions

---

## 13. Presentation / Fullscreen

Single-window topology:

```text
Operator Mode
  ↓ Enter Presentation
Presentation Mode
  ↓ optional requestFullscreen()
Mirrored audience display
```

Presentation hides setup/history/reset/operator instructions.

If fullscreen fails or exits, Presentation Mode remains active and draw continues.

---

## 14. Error Handling

### Setup errors
Invalid rows, duplicates, XLSX parse failure, invalid prize configuration.

**Behavior:** stay in setup; explain exact issue; do not partially apply.

### Live noncritical errors
Sound, confetti, decorative animation, fullscreen.

**Behavior:** warn operator if useful; continue event.

### Live critical errors
No eligible participants, invariant violation, state cannot persist, corrupt recovery state.

**Behavior:** stop draw progression; preserve state; never automatically select a replacement winner.

---

## 15. Testing Strategy

Testing is mandatory because the main concern is Codex breaking existing behavior.

### Unit tests

**Draw engine**
- selects only eligible participants
- valid secure index range
- one eligible participant works
- confirmed/absent/pending never selected

**Participant validation**
- `0027` stays `0027`
- invalid length rejected
- nondigits rejected
- duplicates detected
- optional names preserved

**State machine**
- setup cannot draw
- pending cannot next-prize
- confirm completes prize
- absent returns to same prize
- final confirmation completes event

### Invariant simulation

Repeatedly simulate events with ~80 participants and random absent decisions. Assert:
- no confirmed duplicates
- absent participants never later win
- exactly six confirmed prize winners
- prize index stays valid

### Integration tests
- pending saves/restores
- confirmed saves/restores
- absent saves/restores
- corrupt persisted data is rejected

### Playwright E2E

1. **Normal six-prize event**
2. **Absent → redraw same prize**
3. **Pending → refresh → Resume**
4. **Typing + Space does not draw**
5. **Presentation Mode hides operator UI**

### Visual verification

Capture 1920×1080 screenshots for:
- idle
- prize ready
- reel spinning/stopped
- pending
- confirmed
- Grand Prize

---

## 16. Git / Codex Workflow

Branches:

```text
main
feature/*
fix/*
```

Rules:
- `main` must build and pass tests.
- Codex works in small increments.
- Do not combine large UI redesign and domain rewrite in one commit.
- Create checkpoint commits before risky refactors.

Good Codex task:

> Implement `drawEngine.ts` according to TechDesign section 7. Do not modify React components. Add Vitest tests for all eligibility invariants. Run tests and report changed files.

Bad task:

> Make the lucky draw better.

Recommended Codex loop:
1. Read `AGENTS.md`.
2. Read relevant PRD/TechDesign sections.
3. State plan.
4. Change only required scope.
5. Add/update tests.
6. Run typecheck/tests/build.
7. Summarize changed files and risks.

---

## 17. Setup Checklist

### Foundation
- [ ] Create GitHub repo
- [ ] Install current stable Node.js LTS
- [ ] Scaffold React + TypeScript + Vite
- [ ] Enable strict TypeScript
- [ ] Add Vitest
- [ ] Add Playwright
- [ ] Connect Vercel
- [ ] Deploy a minimal build
- [ ] Add research/PRD/TechDesign docs
- [ ] Commit checkpoint

### Domain
- [ ] Define types
- [ ] Participant validation
- [ ] Eligibility
- [ ] Secure draw engine
- [ ] Event state machine
- [ ] Unit tests

### Persistence/setup
- [ ] Versioned localStorage
- [ ] Resume / Start New
- [ ] Default participant file
- [ ] Paste/CSV
- [ ] XLSX
- [ ] Validation preview

### Presentation
- [ ] Operator workflow
- [ ] Presentation Mode
- [ ] Reel animation
- [ ] Pending/Confirm/Absent controls
- [ ] Sound
- [ ] Grand Prize
- [ ] E2E
- [ ] Three rehearsals

---

## 18. Deployment Plan

```text
GitHub
   ↓
Vercel
   ↓
npm install
npm run build
   ↓
Static Vite output
   ↓
HTTPS production URL
```

The MVP should need no secrets/environment variables.

Before final deployment:
- typecheck
- unit/integration tests
- E2E critical paths
- production build
- manual 1920×1080 review

Backup hosting: Cloudflare Pages can serve the same static build if needed.

---

## 19. Cost

Target: free / near-zero.

| Area | MVP approach | Target |
|---|---|---|
| GitHub | Free repo tier where applicable | $0 |
| Vercel | Free tier if sufficient | $0 |
| Backend | None | $0 |
| Database | None | $0 |
| Runtime AI | None | $0 |
| XLSX parser | Open-source | $0 |
| Testing | Local/free CI allowance | $0 target |
| Audio | Free/internal approved assets | $0 target |

Pricing policies change; verify provider terms before final deployment.

---

## 20. Security & Privacy

Participant names/ticket codes are internal event data.

Requirements:
- no public participant directory
- no analytics transmitting participant names
- no runtime AI service
- no secrets in frontend code
- no auth credentials stored
- store only event-required data
- avoid remote logging of names
- clear event state after use if appropriate

Limitation: browser storage is locally editable; this is an internal event tool, not a tamper-resistant regulated lottery system.

---

## 21. Performance & Accessibility

Performance focus:
- smooth reel animation
- no layout shift during winner reveal
- quick startup
- preload live-use audio
- avoid unnecessary optimization

Accessibility/event readability:
- high contrast
- large digits
- status not communicated by color alone
- keyboard-safe operator controls
- target 1920×1080
- avoid excessive flashing
- final result must become static/readable

---

## 22. Feature Complexity

| Feature | Complexity | Main risk | Tests |
|---|---|---|---|
| Import/validation | Medium | XLSX/data edge cases | parser/unit |
| Draw engine | Medium | eligibility/integrity | unit/invariant |
| Pending/Confirm/Absent | Medium | state transitions | state tests |
| Presentation/reels | Hard | visual polish causing regressions | visual/E2E |
| Recovery/safety | Hard | wrong resume/state corruption | integration/E2E |

---

## 23. Maintenance

Before the event:
- pin dependency versions
- avoid major upgrades
- add no convenience library without clear value
- freeze dependencies before final three rehearsals
- update docs/tests whenever product decisions change

After the event, if maintained:
- review dependencies monthly
- review Vercel/tool policy changes
- review XLSX parser notices
- update `AGENTS.md` when architecture changes

---

## 24. Open Questions

| Question | Status | Default |
|---|---|---|
| Exact XLSX package/version? | TBD | Stable pinned browser-compatible `xlsx` package |
| Exact Vercel URL/domain? | TBD | Vercel-generated HTTPS URL |
| Sound default state? | TBD | Enable after explicit user interaction |
| Exact reel/countdown timing? | TBD | Tune during rehearsal |
| Rehearsal/Test Mode before event? | P1 | Only after P0 stable |
| Results export before event? | P1 | Defer unless time remains |
| Default participant filename? | Minor | `public/data/participants.json` |

---

## Handoff Context
<!-- Machine-readable summary for Part 4. Do not delete. -->

- Stage: techdesign
- Status: Ready for AGENTS.md
- App name: VPBank Lucky Draw
- User level: A
- Target platform: hosted web application
- Event: DPC Party H1.2026
- Event date: 2026-08-27 night
- Budget: free / near-zero infrastructure cost
- Timeline: production-ready before 2026-08-27 including rehearsals
- Chosen stack: React + TypeScript + Vite + Vitest + Playwright + versioned localStorage + Web Crypto + XLSX parser + Vercel
- Frontend: React
- Language: TypeScript
- Build tool: Vite
- Backend: none
- Database: none
- Persistence: versioned localStorage
- Hosting: Vercel
- Source control: Git + GitHub
- Unit/integration tests: Vitest
- E2E tests: Playwright
- XLSX: pinned browser-compatible parser; SheetJS xlsx default candidate
- RNG: crypto.getRandomValues() with rejection sampling
- State architecture: pure TypeScript domain/state machine + React UI adapter
- UI topology: single window with Operator Mode and Presentation Mode
- Draw rule: pending winner persisted before reveal animation
- Winner lifecycle: Pending → Confirm OR Absent & Redraw
- Audio: bundled/Web Audio; Sound On/Off; noncritical
- Fullscreen: presentation enhancement; noncritical
- AI coding tool: Codex
- Runtime AI features: none
- Main concerns: wrong tech choices; AI changes breaking existing functionality
- Engineering rule: correctness and recoverability over animation complexity
- Domain guardrail: UI/animation must not implement or mutate eligibility rules
- Testing guardrail: domain/state changes require tests; critical paths require E2E
- Dependency policy: minimal, pinned, frozen before final rehearsals
- Deployment: GitHub → Vercel → HTTPS URL
- P0 implementation order: domain correctness → persistence/safety → setup/import → presentation → audio/polish → rehearsal
- Source files: research-VPBankLuckyDraw.md → PRD-VPBankLuckyDraw-MVP.md → TechDesign-VPBankLuckyDraw-MVP.md
- Next workflow step: Part 4 — AGENTS.md and Codex project guidance
