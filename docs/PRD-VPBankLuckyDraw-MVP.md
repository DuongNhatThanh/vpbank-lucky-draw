# PRD — VPBank Lucky Draw MVP

**Product:** VPBank Lucky Draw  
**Event:** DPC Party H1.2026  
**Version:** 1.0 Approved  
**PRD Path:** A — Vibe-Coder  
**Target:** Hosted web application  
**Event date:** Night of 27 August 2026  
**Status:** Approved for Technical Design handoff

## 1. Product Overview

VPBank Lucky Draw is a hosted web application for DPC Party H1.2026. Approximately 80 participants have unique four-digit ticket codes. The application conducts exactly six prize draws and reveals each predetermined winning code through four vertical slot-machine-style reels.

The application has two modes in one browser window: **Operator Mode** for setup, controls, progress, history and recovery; and **Presentation Mode** for the mirrored audience display.

**Core design rule:** *Slot-machine mechanics, VPBank aesthetics.*

The product must feel premium, modern, exciting, trustworthy and VPBank-branded, without casino/gambling imagery such as jackpot language, chips, coins, 777 symbolism, pull levers or dominant casino red/gold styling.

### Problem

Generic lucky-draw tools do not satisfy the required combination of controlled participant-pool selection, leading-zero preservation, no-repeat winners, six-prize workflow, absent-winner handling, operator safeguards, recoverable state, VPBank presentation, and sequential four-digit reveal.

### Launch goal

Successfully run all six prize draws during DPC Party H1.2026 with no draw-integrity failure, duplicate winner, or unrecoverable loss of event state.

## 2. Target Users

### Primary — MC / Event Operator

Needs to open a shared URL, verify participants, always know the current prize, start a draw safely, confirm a present winner, handle an absent winner, recover after refresh, and finish all six prizes without technical knowledge.

**UX principle:** The correct action should be obvious and dangerous actions should be difficult.

### Secondary — Audience

Needs to understand the current prize, draw progress, winning four-digit code, winner name when available, and Grand Prize status. The audience must not see configuration, import controls, debug information, reset controls, or operator instructions.

### Setup user — Event Organizer

Prepares default participant data, verifies approximately 80 records, confirms six prizes, rehearses the full flow, checks browser/display/audio behavior, and sends the deployed URL to the operator.

## 3. Core User Journey

### Startup

```text
Open shared URL
      ↓
Check unfinished local session
      ↓
No session → SETUP

Previous session →
  Resume Previous Session
  Start New Session (confirmation required)
```

### Setup

```text
Load default participant data
      ↓
Optional override:
Paste / CSV / XLSX
      ↓
Preview & Validate
      ↓
Explicit Apply
      ↓
Review six prizes
      ↓
Enter Presentation
```

Configuration locks once the first real draw starts.

### Prize flow

```text
PRIZE READY
    ↓
START DRAW
    ↓
COUNTDOWN
    ↓
Secure winner selection
    ↓
Persist Pending Winner
    ↓
4 REELS SPIN
    ↓
SEQUENTIAL STOP
    ↓
PENDING WINNER
    ├── CONFIRM WINNER → Prize Complete → Next Prize
    └── MARK ABSENT & REDRAW → Exclude participant → Same Prize
```

A revealed participant is not an official winner until confirmed.

For Prize 6, the same logic applies with a distinct Grand Prize presentation. After confirmation, the event enters EVENT COMPLETE.

## 4. P0 Must-Have Features

### P0-1 — Participant Setup, Import & Validation

The deployed project ships with default participant data. Before the first draw, the MC may edit/replace it through:

- Paste/manual input
- CSV import
- Excel `.xlsx` import

Participant model:

```text
code
code + optional name
```

Example:

```text
0027,Nguyễn Văn A
0145,Trần Thị B
```

Validation must report at least rows received, valid participants, duplicate codes and invalid rows.

Rules:
- Codes display as exactly four digits.
- Leading zeros are preserved.
- Duplicate codes are invalid.
- Invalid records are surfaced.
- Imported data is previewed before use.
- MC explicitly applies the validated list.
- Invalid configuration cannot start a live draw.
- Participant configuration locks after the first draw.

**Acceptance criteria**
- [ ] Default participant data loads.
- [ ] `0027` remains `0027`.
- [ ] Duplicate and invalid records are reported.
- [ ] Paste, CSV and XLSX imports work.
- [ ] Preview occurs before Apply.
- [ ] Apply requires explicit operator action.
- [ ] Configuration locks after live drawing begins.

### P0-2 — Reliable Six-Prize Draw Engine

The event has exactly six prizes.

Winner selection must:
- Select a participant record from the eligible pool.
- Use `crypto.getRandomValues()`.
- Preserve the four-digit code.
- Exclude confirmed and absent participants.
- Prevent concurrent/double draw execution.

Required separation:

```text
eligible pool
    ↓
secure random selection
    ↓
persist pending winner
    ↓
animation receives immutable code
    ↓
visual reveal
```

Animation never determines the official result.

**Acceptance criteria**
- [ ] Exactly six prizes can be completed.
- [ ] Every selection belongs to the valid pool.
- [ ] `Math.random()` is not used for official selection.
- [ ] Leading zeros survive selection and display.
- [ ] Confirmed and absent participants cannot be selected again.
- [ ] Double-click cannot create two pending winners.
- [ ] No draw occurs while another draw is active.
- [ ] No draw occurs beyond Prize 6.
- [ ] Animation cannot alter the selected result.

### P0-3 — Pending Winner / Confirm / Absent & Redraw

After reveal, the participant becomes **Pending Winner**.

MC receives:
- `CONFIRM WINNER`
- `MARK ABSENT & REDRAW`

Confirm:
- Commits official winner.
- Excludes participant from remaining prizes.
- Completes current prize.
- Records result in history.
- Enables Next Prize.

Absent:
- Records the attempt as absent/voided.
- Excludes participant from all remaining prizes.
- Does not complete current prize.
- Returns to the same prize for redraw.

**Acceptance criteria**
- [ ] Reveal enters Pending state.
- [ ] Next Prize is blocked while Pending.
- [ ] Confirm completes the prize.
- [ ] Absent does not complete the prize.
- [ ] Voided attempt remains in history.
- [ ] Absent participant cannot be selected again.
- [ ] Same prize can be redrawn.
- [ ] Pending, Confirmed and Absent states survive recovery.

### P0-4 — VPBank Presentation Experience

Minimum presentation states:

```text
EVENT OPENING / IDLE
PRIZE READY
COUNTDOWN
REELS SPINNING
SEQUENTIAL STOP
WINNING NUMBER HOLD
PENDING WINNER
CONFIRMED WINNER
GRAND PRIZE
EVENT COMPLETE
```

The presentation uses four vertical reels in one unified visual object. Reels spin vertically, decelerate and stop sequentially. The final number remains highly readable.

After confirmation:
1. Hold winning code.
2. Show `CONGRATULATIONS`.
3. Show winner name if available.
4. Trigger celebration.
5. Hold long enough for audience recognition/photos.

If no participant name exists, omit the name area cleanly.

Grand Prize may use a stronger countdown, glow, champagne/gold secondary accent, larger celebration and stronger winner sound while remaining recognizably VPBank.

Sound effects:
- Countdown
- Reel spin
- Reel/digit stop
- Winner reveal
- Clear Sound On/Off
- No background-music subsystem

Brand:
- Event title: **DPC Party H1.2026**
- Official VPBank logo preserved.
- VPBank green dominates.
- Red is controlled accent.
- White supports high-contrast typography.
- Champagne/gold is restrained and Grand-Prize-oriented.
- Casino/gambling visual language is prohibited.

**Acceptance criteria**
- [ ] Presentation hides setup/operator UI.
- [ ] Four reels are clear at 1920×1080.
- [ ] Winning number is a dominant visual element.
- [ ] Reels stop sequentially.
- [ ] Winner name is conditional.
- [ ] Grand Prize is distinct.
- [ ] Sound can be disabled immediately.
- [ ] Draw works with sound off.
- [ ] Presentation works in fullscreen and remains usable without it.
- [ ] No prohibited casino imagery appears.

### P0-5 — Live-Event Safety, Progress & Recovery

Once the first real draw begins, lock participant configuration, imports, prize configuration and event title.

Desired shortcuts may include:
- `Space` — Start Draw
- `ArrowRight` — Next Prize
- `Escape` — exit presentation/fullscreen where appropriate

Shortcuts must be ignored in input, textarea, select, contenteditable or other editable controls.

Safety:
- Draw disabled while drawing.
- Next Prize disabled until confirmation.
- Completed prize cannot be redrawn accidentally.
- No prize after Prize 6.
- Reset requires confirmation.
- Current prize and progress are always visible to MC.

Persist enough local state to recover:
- Participant configuration
- Remaining eligible pool
- Confirmed winners
- Absent participants
- Voided attempts
- Pending winner
- Current prize
- Prize configuration
- Event lock/start state
- Relevant presentation state

On startup with unfinished state:
- `Resume Previous Session`
- `Start New Session`

Start New requires confirmation before clearing previous progress.

**Acceptance criteria**
- [ ] Configuration locks after first draw.
- [ ] Shortcuts do not fire while typing.
- [ ] Draw locks during an active draw.
- [ ] Next Prize requires confirmed winner.
- [ ] Reset requires confirmation.
- [ ] Refresh recovers confirmed winners.
- [ ] Refresh during Pending recovers the pending winner.
- [ ] Absent participants remain absent after recovery.
- [ ] Resume restores correct prize.
- [ ] Start New warns before clearing progress.
- [ ] Audio/confetti/visual-effect failure cannot lose the official result.

## 5. P1 Nice-to-Have

Only implement after all P0 criteria and full rehearsals are stable:

- Rehearsal/Test Mode isolated from production state
- Export results to CSV
- Session backup import/export
- Dedicated opening animation
- Between-prize transitions
- Event-complete six-winner summary

## 6. Explicitly Out of Scope

- User accounts/authentication
- Cloud database
- Backend API
- Multi-user collaboration
- Dual-window synchronization
- Participant self-registration
- QR ticket generation
- Email/SMS/push
- Payments
- Public raffle platform
- Multi-event administration
- Social sharing
- Background-music management
- Casino/gambling simulation
- Analytics platform

## 7. Success Metrics

### Primary

On the night of **27 August 2026**, the MC completes **6/6 prize draws end-to-end** without a program-interrupting error, duplicate winner, or unrecoverable state loss.

### Secondary

Before the event, the application passes **at least 3 consecutive full rehearsals**, each with approximately 80 participants and all six prizes.

Across the rehearsals, test at minimum:
- One `Mark Absent & Redraw`.
- One `Refresh → Resume Previous Session`.

A rehearsal fails if winner duplication occurs, state cannot recover, the wrong prize advances, eligibility becomes inconsistent, or continuing requires manual code/data repair.

## 8. Look & Feel

**Design vibe:** Premium · Modern · Exciting · Trustworthy · VPBank-branded.

Audience hierarchy:
1. Current prize
2. Four-digit draw/winning number
3. Winner
4. Event identity
5. Secondary decoration

Operator hierarchy:
1. Current state/current prize
2. Primary allowed action
3. Participant validity
4. Prize progress
5. History
6. Configuration

The title **DPC Party H1.2026** should behave like a presentation-slide event title, not a form label.

The four reels should feel like one designed stage object rather than four unrelated dashboard cards.

## 9. Conceptual Wireframes

### Operator Setup

```text
┌──────────────────────────────────────────────────────────┐
│ VPBank                    DPC Party H1.2026              │
├────────────────────────────┬─────────────────────────────┤
│ PARTICIPANTS               │ EVENT / 6 PRIZES            │
│ 80 valid                   │ Prize 1 [...]               │
│ 0 duplicate                │ ...                         │
│ 0 invalid                  │ Prize 6 [GRAND PRIZE]       │
│                            │                             │
│ [Paste] [CSV] [XLSX]       │                             │
│ Preview                    │                             │
│ [APPLY PARTICIPANTS]       │ [ENTER PRESENTATION]        │
└────────────────────────────┴─────────────────────────────┘
```

### Presentation

```text
┌──────────────────────────────────────────────────────────┐
│ VPBank                              DPC Party H1.2026     │
│                                                          │
│                       GIẢI NHẤT                          │
│                                                          │
│              ╔════╦════╦════╦════╗                      │
│              ║ 8  ║ 5  ║ 2  ║ 7  ║                      │
│              ╚════╩════╩════╩════╝                      │
│                                                          │
│                  CONGRATULATIONS                         │
│                   NGUYỄN VĂN A                          │
└──────────────────────────────────────────────────────────┘
```

## 10. Product-Level State Model

```text
SETUP
  ↓
READY
  ↓
COUNTDOWN
  ↓
DRAWING
  ↓
REEL_STOPPING
  ↓
PENDING_WINNER
  ├── CONFIRM → PRIZE_COMPLETE → NEXT_PRIZE
  └── ABSENT  → PRIZE_READY (same prize)
```

Final prize confirmation leads to `EVENT_COMPLETE`.

State invariants:
- At most one pending winner.
- Completed prize has exactly one confirmed winner.
- Incomplete prize has no confirmed winner.
- Confirmed, absent and current pending participants cannot be selected.
- Prize cannot advance while incomplete.
- Prize index cannot exceed six.

## 11. Technical Considerations for Tech Design

These are constraints, not final architecture decisions:

- Hosted, shareable web application; HTTPS preferred.
- No backend required by current MVP.
- Default participants live in project data rather than draw-engine logic.
- XLSX import is P0; Tech Design must choose the browser-compatible implementation.
- Official RNG uses `crypto.getRandomValues()`; consider unbiased integer/rejection sampling.
- Browser-side persistence is sufficient for the confirmed one-device workflow.
- Persistence is recovery state, not secure/tamper-proof storage.
- Fullscreen is supported but noncritical.
- Audio initialization must account for browser user-interaction rules.
- Primary presentation target is 16:9 / 1920×1080.
- Avoid unnecessary analytics or third-party participant-data transmission.

## 12. Reliability & Failure Handling

Priority:

> **Correctness → Operator Safety → Recovery → Presentation → Animation → Polish**

Confetti, decorative glow, sound, transitions and fullscreen are noncritical.

Conceptual commit order:

```text
Select winner
    ↓
Persist Pending Winner
    ↓
Animate reveal
    ↓
MC decision
    ↓
Persist Confirmed or Absent
    ↓
Celebration / transition
```

## 13. Definition of Done

The MVP is done only when:

- [ ] Default, paste, CSV and XLSX participant loading works.
- [ ] Leading zeros, duplicate detection and invalid-row reporting work.
- [ ] Exactly six prizes complete correctly.
- [ ] No confirmed/absent participant can repeat.
- [ ] Official winner is independent of animation.
- [ ] Double-click cannot create multiple draws.
- [ ] Pending → Confirm works.
- [ ] Pending → Absent → Redraw works on the same prize.
- [ ] Configuration locks during the live event.
- [ ] Keyboard shortcuts are safe while editing.
- [ ] Reset requires confirmation.
- [ ] Refresh recovers Confirmed, Pending and Absent states.
- [ ] Audience sees no operator controls in Presentation Mode.
- [ ] Four vertical reels stop sequentially.
- [ ] Winning number is legible at 1920×1080.
- [ ] Conditional winner-name reveal works.
- [ ] Grand Prize treatment works.
- [ ] Sound On/Off works.
- [ ] Draw works without sound and without fullscreen.
- [ ] No casino/gambling visual language is present.
- [ ] Three consecutive full rehearsals pass.
- [ ] Rehearsals include Absent/Redraw and Refresh/Resume scenarios.

## 14. Delivery Priority Before 27 August 2026

1. **Correctness:** participant model, validation, six-prize state, RNG, eligibility.
2. **Operator Safety & Recovery:** locks, safeguards, history, persistence, resume.
3. **Presentation:** VPBank stage, four reels, sequential stop, winner reveal, Grand Prize.
4. **Event Polish:** sound, confetti, transitions.
5. **Rehearsal:** stop adding optional features if they threaten rehearsal readiness.

## 15. Locked Product Decisions

Implementation agents must treat these as decided unless the PRD is explicitly revised:

1. Hosted website distributed by URL.
2. No backend required for MVP.
3. Approximately 80 participants with unique four-digit codes.
4. Exactly six prizes.
5. Default participant data plus pre-event override.
6. Paste, CSV and XLSX import are P0.
7. Preview/validation precedes Apply.
8. `crypto.getRandomValues()` selects official winners.
9. Animation never selects the winner.
10. Revealed winner is Pending until MC action.
11. MC chooses Confirm or Mark Absent & Redraw.
12. Absent participant is excluded from remaining prizes; attempt remains in history.
13. Confirmed winner cannot repeat.
14. Recovery offers Resume Previous Session / Start New Session.
15. Single-window Presentation Mode with mirrored event display.
16. Basic sound effects plus Sound On/Off.
17. Winner name displays only when available.
18. Four vertical reels are the core presentation metaphor.
19. VPBank branding dominates; casino imagery is prohibited.
20. Grand Prize has distinct presentation treatment.
21. Reliability/rehearsal readiness outranks visual polish.
22. Production target is the night of 27 August 2026.

## 16. Handoff Context
<!-- Machine-readable summary for the next workflow step. Do not delete. -->

- Stage: PRD
- Status: Approved
- PRD path: A — Vibe-Coder
- App name: VPBank Lucky Draw
- Event: DPC Party H1.2026
- Event date: 2026-08-27 night
- Target platform: hosted web application
- Primary user: MC / event operator
- Secondary user: event audience
- Participants: approximately 80
- Participant identifier: unique 4-digit code; leading zeros preserved
- Participant name: optional
- Default participant source: project data file
- Participant override: allowed before first draw
- Import: paste, CSV, XLSX
- Import workflow: preview → validate → explicit apply
- Prize count: exactly 6
- Winner RNG: crypto.getRandomValues()
- Winner repeat: prohibited
- Winner lifecycle: select → persist pending → animate → Confirm OR Mark Absent & Redraw
- Confirm: completes prize and excludes participant
- Absent: retains voided attempt, excludes participant, redraws same prize
- Recovery: Resume Previous Session / Start New Session
- Display: single browser window, mirrored audience display
- Fullscreen: supported but noncritical
- Audio: countdown, reel, stop, winner effects; Sound On/Off
- Background music: out of scope
- Visual direction: Premium, Modern, Exciting, Trustworthy, VPBank-branded
- Design rule: Slot-machine mechanics, VPBank aesthetics
- Casino imagery: prohibited
- Core presentation: four vertical reels, sequential stopping
- Grand Prize: distinct premium state
- Backend: none required for MVP
- Primary success metric: 6/6 live draws without interrupting error, duplicate winner, or unrecoverable state loss
- Secondary success metric: 3 consecutive full rehearsals including Absent/Redraw and Refresh/Resume
- Priority: correctness → operator safety → recovery → presentation → animation → polish
- P0: participant setup/import/validation; six-prize draw engine; pending/confirm/absent workflow; VPBank presentation; safety/progress/recovery
- P1: rehearsal mode; results export; session backup; opening animation; transitions; final summary
- Out of scope: authentication, backend/cloud DB, dual-window sync, participant self-registration, background music, analytics
- Source research: research-VPBankLuckyDraw.md
- Next workflow step: Technical Design
