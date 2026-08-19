# Deep Research — VPBank Lucky Draw

**App name:** VPBank Lucky Draw  
**Event:** DPC Party H1.2026  
**Research date:** 2026-08-19  
**User level:** A — Vibe-coder  
**Target platform:** Hosted web application  
**Event date:** Night of 2026-08-27  
**Status:** Deep Research v1.0 — Interview completed, pending Verification Echo

> This document follows the Deep Research stage of the `vibe-coding-prompt-template` workflow. It deliberately keeps detailed architecture choices for the later Tech Design stage.

---

## 1. Project name

### VPBank Lucky Draw

A browser-based, offline-capable lucky draw experience for **DPC Party H1.2026**, designed for approximately 80 participants, six prizes, and a large audience display.

Each participant has a unique four-digit ticket code. For every prize, the application selects one eligible participant and reveals the winning code through a four-reel, slot-machine-inspired animation.

The intended design principle is:

> **Slot-machine mechanics, VPBank aesthetics.**

This means using reel movement, sequential stopping, anticipation, and a strong winner reveal while avoiding gambling/casino imagery.

---

## 2. Core concept

### 2.1 Problem being solved

Generic lucky-draw websites do not fit the desired event experience well enough.

Common approaches such as wheels, generic random-number generators, and name pickers create one or more problems for this event:

- A wheel becomes visually crowded with roughly 80 entries.
- A random number generator can generate numbers that do not correspond to issued tickets unless it is constrained to the actual participant list.
- Generic tools provide limited control over VPBank branding.
- Generic raffle interfaces often expose controls that should not appear on the audience screen.
- Most do not provide the desired four-digit sequential reveal.
- Event reliability and operator safeguards are difficult to tailor.

The project therefore benefits from a purpose-built local web application.

### 2.2 Core event mechanic

The system should:

1. Load approximately 80 valid participants.
2. Preserve each participant's unique four-digit ticket code, including leading zeros.
3. Maintain a pool of participants still eligible to win.
4. For each of exactly six prizes, select one winner from that eligible pool.
5. Commit the selected winner before presentation animation begins.
6. Animate four visual reels.
7. Stop the reels sequentially to reveal the predetermined code.
8. Show the winner's name when available.
9. Remove that winner from future eligibility.
10. Persist enough state to recover safely from an accidental refresh.

### 2.3 Why a custom browser app is appropriate

This project has a narrow scope, a small participant count, no need for accounts, and no need for server-side collaboration. Browser APIs already provide the core capabilities required for random selection, fullscreen presentation, local state, audio, and animation.

`crypto.getRandomValues()` provides cryptographically strong random values and is broadly available. Importantly for an offline/local implementation, MDN states that `getRandomValues()` is the one `Crypto` method usable in an insecure context. This makes it suitable for the winner-selection primitive even if the app is not deployed over HTTPS.

The main architectural uncertainty is not whether the browser can perform the draw, but **how the app should be launched and how state recovery should work**. Opening the final application directly through a `file:` URL is attractive for simplicity, but browser behavior for `localStorage` on `file:` URLs is explicitly undefined. Therefore a tiny local HTTP server is likely safer for the event build if reliable recovery is a requirement.

### 2.4 Product principles

1. **Reliability before spectacle.**
2. **The draw engine and animation engine are separate.**
3. **Operator UI and audience UI have different jobs.**
4. **The audience should never see configuration or technical controls.**
5. **The application must remain understandable if sound or decorative effects fail.**
6. **The final winning number must be visually dominant.**
7. **The visual metaphor is a four-reel slot machine, not a casino game.**
8. **The official VPBank logo is preserved, not redesigned.**
9. **The application should have no runtime Internet dependency.**
10. **The codebase should remain small enough for a vibe-coder and Codex to reason about safely.**

### 2.5 Recommended experience states

The presentation experience should be treated as a sequence of explicit states rather than one screen whose elements are continuously mutated:

```text
SETUP
  ↓
IDLE / EVENT OPENING
  ↓
PRIZE READY
  ↓
COUNTDOWN
  ↓
REELS SPINNING
  ↓
SEQUENTIAL REEL STOP
  ↓
WINNING NUMBER HOLD
  ↓
WINNER NAME REVEAL
  ↓
PRIZE COMPLETE
  ↓
NEXT PRIZE
```

For prize six:

```text
GRAND PRIZE READY
  ↓
GRAND PRIZE DRAW
  ↓
GRAND PRIZE WINNER
  ↓
EVENT COMPLETE
```

This explicit state model is a high-value direction for the later Tech Design because it reduces accidental actions and makes UI behavior easier to test.

---

## 3. Target users

### 3.1 Primary user — MC / event operator

The operator is responsible for running the application live.

#### Needs

- A simple setup process.
- Clear participant validation.
- A clear indication of the current prize.
- One obvious action to start a draw.
- Strong protection against accidental double draws.
- No keyboard shortcuts firing while typing.
- Automatic locking of configuration once the live draw begins.
- Winner history.
- Prize progress.
- Safe reset behavior.
- Recovery after an accidental refresh or browser restart.
- Confidence that visual effects cannot change the selected winner.

#### Main pain points

The highest-risk UX failures are operational rather than computational:

- Drawing while editing a text field.
- Drawing the same prize twice.
- Advancing to the next prize accidentally.
- Editing the participant pool after draws have started.
- Resetting live results.
- Losing winners after refresh.
- Discovering duplicate or malformed participant codes only during the event.
- Audio/fullscreen failing because browser permission behavior was not rehearsed.

The operator interface should therefore prioritize safety and clarity over visual flourish.

### 3.2 Secondary user — audience

The audience primarily needs to understand three things:

1. Which prize is being drawn.
2. What number is being revealed.
3. Who won.

Audience-facing presentation should remove operator controls and secondary status information.

The four-digit number should become the hero visual. On a large 16:9 screen, the reels should occupy a substantial central area and remain readable from several meters away.

### 3.3 Event organizer / setup user

The organizer may be the same person as the operator but has a distinct pre-event task:

- Prepare the participant list.
- Verify approximately 80 records.
- Configure six prize labels.
- Rehearse the complete flow.
- Confirm sound/display behavior on the actual event laptop.
- Confirm the correct VPBank logo and event title.

### 3.4 Privacy consideration

Participant names are employee information. This application does not need cloud storage or third-party analytics. Keeping participant data on the event laptop reduces unnecessary external data flow.

If browser storage is used for recovery, treat it as convenience storage rather than secure storage. Browser storage can be inspected and modified locally, and security guidance warns against placing sensitive information or credentials there. The app has no authentication requirement, so no credentials should exist in browser storage at all.

For the event, store only what is needed: ticket code, optional display name, prize result, and draw state. Clear the event state when no longer required.

Winner-name display is data-aware: if a participant record contains a name, the confirmed winner reveal may show it; if no name is available, the presentation should omit the name area cleanly rather than showing an empty placeholder.

---

## 4. Technical decisions (if any)

Detailed architecture belongs in the Tech Design step. The research supports the following high-level decisions and constraints.

### 4.1 Platform: browser-based web app

**Recommendation: Yes.**

Why:

- Matches the existing prototypes.
- Requires no app installation.
- Works well with a laptop connected to TV/projector/LED.
- Supports fullscreen, animation, keyboard controls, Web Audio, and local persistence.
- Can run without backend services.

### 4.2 Backend: none for MVP

**Recommendation: No backend.**

A backend would add deployment, networking, authentication, and failure modes without solving a requirement that exists for this single-event application.

The participant pool is small, and all state can be held locally.

### 4.3 Framework: keep the implementation lightweight

The research does not show a requirement that justifies a heavy application framework.

A small modular HTML/CSS/JavaScript application is sufficient in capability. Whether the development project should use a minimal bundler/dev server such as Vite should be decided in Tech Design.

The important distinction is:

- **Development:** modular source files are desirable for Codex, testing, and maintainability.
- **Event delivery:** the build should be simple to launch and have no Internet dependency.

Do not preserve the current single-file prototype as the development architecture merely because it is easy to distribute.

### 4.4 Randomness

Use `crypto.getRandomValues()` as the winner-selection primitive.

Do not use `Math.random()` for selecting winners.

The draw flow should be:

```text
eligible pool
    ↓
secure random index
    ↓
winner committed to application state
    ↓
reveal animation receives winning code
```

The reel animation must never generate the official result.

#### Bias note

If a random `Uint32` is reduced with `% poolSize`, there is a small theoretical modulo bias whenever the pool size does not evenly divide the integer range. For an internal draw with approximately 80 entries this is operationally tiny, but a rejection-sampling helper is simple enough that Tech Design should consider using it. Doing so removes an avoidable fairness question at very low implementation cost.

### 4.5 Deployment and launch strategy

The production direction is now a **hosted website** rather than a local-only/offline package.

The organizer should be able to send the MC a URL. The MC opens the URL in Chrome/Edge and prepares/runs the event without installing development tooling or starting a local server.

Recommended MVP deployment characteristics:

- Static web hosting is sufficient if all event state remains client-side.
- No backend is required for the confirmed workflow.
- The participant defaults ship as a project data file.
- The MC can replace the defaults before the event begins.
- Use HTTPS hosting so browser origin/storage behavior is stable.
- Keep runtime dependencies bundled with the site where practical.
- The application should degrade gracefully if a nonessential external resource is unavailable.

Because production is hosted, the earlier concern about relying on `localStorage` from a `file:` URL no longer applies to the primary deployment path.

### 4.6 Session recovery

Do not treat `localStorage` as an authoritative secure database.

For this app, it can be acceptable as a recovery mechanism when served from a stable localhost origin, because the stored information is event state rather than authentication secrets.

Recommended behavior:

- Persist state after every important transition.
- Version the saved state schema.
- Save completed winners before running nonessential celebration effects.
- On startup, detect an unfinished session.
- Show **Resume Previous Session** and **Start New Session** rather than auto-resuming.
- Resume must restore current prize, pending winner (if any), confirmed winners, absent participants, remaining pool, configuration lock, and history.
- Starting new must require confirmation before clearing the previous session.

Potential future enhancement: export/import a small backup JSON file before the event.

### 4.7 Fullscreen

Fullscreen is appropriate for the audience experience, but entering fullscreen requires browser/user permission and typically user activation.

Therefore:

- The operator should explicitly click **Enter Presentation**.
- Fullscreen failure must not break the draw.
- The presentation layout should still work in a maximized browser window.
- Rehearsal should include exiting fullscreen, tab switching, and reconnecting the display.

### 4.8 Audio

Sound effects are confirmed for the MVP, but audio must remain optional at runtime through a clear **Sound On/Off** control.

Chrome applies autoplay rules to Web Audio. The safe pattern is to initialize/resume audio from an explicit operator interaction such as **Enter Presentation**, **Enable Sound**, or the first **Start Draw** click.

Recommended audio hierarchy:

- Countdown cue.
- Soft reel tick/spin texture.
- Distinct stop cue for each digit.
- Winner sting.
- Stronger Grand Prize sting.

The application must remain fully usable with audio muted.

### 4.9 Participant data and import

The confirmed workflow is **default data + operator override**.

The deployed website ships with a default participant data file in the project. Before the first draw, the MC may replace or edit that participant set.

The MVP must support:

1. Default participant data loaded from a project data file.
2. Paste/manual input.
3. CSV import.
4. Excel `.xlsx` import.
5. Preview and validation before applying imported data.

Validation should report at minimum:

```text
Rows received
Valid participants
Duplicate codes
Invalid rows
```

Imported data must not silently replace the active pool. The MC should review the validation result and explicitly apply the participant list.

The default participant file should be data, not application logic, so updating the event list does not require editing draw-engine code.

### 4.10 Presentation topology

The confirmed MVP uses a **single browser window**.

The event setup is intentionally simple: the laptop display is mirrored/duplicated to the TV, projector, or LED screen.

The application therefore needs two UI modes in the same window:

- **Operator Mode** — configuration, validation, history, controls.
- **Presentation Mode** — audience-facing stage with operator UI hidden.

A dual-window / `BroadcastChannel` architecture is not required for this MVP.

Presentation Mode should support fullscreen, but draw correctness must not depend on fullscreen succeeding.

### 4.11 Winner confirmation and absence handling

A revealed winner is **not immediately finalized**.

The confirmed live workflow is:

```text
Draw
  ↓
Winning code selected
  ↓
Four-reel reveal
  ↓
PENDING WINNER
  ├── CONFIRM WINNER → prize completed
  └── MARK ABSENT & REDRAW → participant excluded, same prize redrawn
```

Rules:

- A pending winner cannot be selected by another draw while pending.
- `CONFIRM WINNER` commits the winner to the current prize.
- Only a confirmed winner completes the prize and enables Next Prize.
- `MARK ABSENT & REDRAW` records the attempt as voided due to absence.
- An absent participant is removed from eligibility for all remaining prizes.
- The current prize remains incomplete and is drawn again.
- History should distinguish confirmed winners from absent/voided draw attempts.
- Session recovery must preserve pending, confirmed, and absent states correctly.

This workflow provides an explicit operator checkpoint between theatrical reveal and official prize completion.

### 4.12 VPBank visual direction

VPBank's official 2022 brand repositioning retained the traditional red/green identity and prosperity-flower mark, while moving toward a brighter green and a more modern visual treatment. The official brand statement is **“Vì một Việt Nam thịnh vượng.”**

For this event application:

- Deep green can provide stage depth.
- Brighter VPBank green should provide brand energy.
- Red should remain an accent.
- White should carry primary typography.
- Champagne/gold can be reserved for Grand Prize.
- The official logo should not be altered.
- Abstract geometry inspired by the prosperity-flower shape can be used subtly in backgrounds.
- Avoid copying the logo into repetitive decorative patterns that reduce its authority.

### 4.13 Slot-machine visual direction

The visual reference is useful for mechanics, not for literal styling.

Borrow:

- Unified machine/frame.
- Four clearly separated reels.
- Vertical number movement.
- Center line / depth.
- Sequential stopping.
- Mechanical anticipation.
- Strong “result locked” moment.

Reject:

- `777`.
- Jackpot language.
- Coins/chips.
- Pull lever.
- Flashing casino bulbs.
- Red/gold-dominant casino cabinet.
- Gambling iconography.

A premium corporate interpretation should feel closer to a kinetic event installation than a casino machine.

### 4.14 AI-assisted development

Codex is suitable for implementation if the project context is made explicit.

The repository workflow being followed recommends:

```text
Research → PRD → Tech Design → AGENTS.md → MVP
```

The research artifact should therefore avoid prematurely hard-coding implementation details that belong in Tech Design.

After Tech Design, the project should generate:

- `AGENTS.md`
- `MEMORY.md`
- `REVIEW-CHECKLIST.md`
- focused `agent_docs/`
- small feature specs during implementation

For Codex specifically, `AGENTS.md` should be the canonical contract. Build in small verified passes rather than asking Codex to regenerate the whole application repeatedly.

---

## 5. Competitor insights

This project is not intended to become a commercial raffle SaaS, so competitor research is primarily useful for identifying interaction patterns and gaps rather than market sizing.

### 5.1 Lucky Draw Studio

Previously evaluated as a close generic alternative.

Useful patterns:

- Quick participant entry.
- Multiple visual draw modes.
- Slot-machine metaphor.
- Low setup friction.

Gap for this project:

- Does not precisely deliver the required custom four-digit ticket reveal and VPBank-specific event presentation.
- Limited control over the exact audience experience and live-event safeguards.

### 5.2 RandomPicker-style raffle tools

Useful patterns:

- Emphasis on structured raffle workflow.
- Multiple prizes.
- Transparency/history concepts.

Gap:

- More oriented toward generic raffle administration than branded theatrical presentation.

### 5.3 Wheel-based randomizers

Useful patterns:

- Extremely easy to understand.
- Immediate audience feedback.

Gap:

- Roughly 80 entries make the wheel visually dense.
- Does not match the desired four-digit reveal.
- Harder to create the premium VPBank stage identity.

### 5.4 Generic four-digit random generators

Useful pattern:

- Simple numerical reveal.

Critical gap:

- Randomizing from `0000–9999` is the wrong model when only approximately 80 ticket codes are valid.

The system must select a **participant record**, not independently generate four digits.

### 5.5 Gap to exploit

The custom application's strongest differentiator is the combination of:

- Controlled participant pool.
- Four-digit sequential reveal.
- No duplicate winners.
- Six-prize event workflow.
- Strong operator safeguards.
- VPBank-specific visual identity.
- Offline reliability.
- Clean audience presentation.

No broad commercial feature set is required.

---

## 6. Budget/timeline

### 6.1 Budget

The MVP can reasonably target **near-zero runtime infrastructure cost**.

Required runtime services:

- Backend: none.
- Database: none.
- Cloud hosting: none required.
- External APIs: none required.
- Analytics: none required.

Potential costs are optional:

- Licensed sound effects.
- Licensed event font if VPBank requires a specific non-system font.
- Design assets supplied through official internal brand resources.

Do not introduce a paid service unless it solves a confirmed event requirement.

### 6.2 Development complexity

This is a small application in feature count but a **high-consequence live UX**.

The difficult areas are not database scale or backend architecture. They are:

- State correctness.
- Draw idempotency.
- Recovery.
- Operator safeguards.
- Animation sequencing.
- Large-screen presentation.
- Browser/display rehearsal.

This means engineering effort should be spent on testing and event rehearsal rather than infrastructure.

### 6.3 Suggested implementation milestones

#### Milestone 1 — Stable core

- Modular project setup.
- Participant parsing and validation.
- Six-prize state machine.
- Secure winner selection.
- No-repeat winners.
- Winner history.
- Automated tests for draw logic.

#### Milestone 2 — Operator safety

- Configuration lock.
- Keyboard safety.
- Reset confirmation.
- State persistence and recovery.
- Clear validation summary.
- Prize progress.

#### Milestone 3 — Presentation

- VPBank event stage.
- Four real vertical reels.
- Sequential deceleration/stopping.
- Winner reveal.
- Grand Prize treatment.
- Responsive 16:9 layout.

#### Milestone 4 — Event polish

- Audio.
- Confetti.
- Opening state.
- Between-prize transitions.
- Rehearsal/test mode if time permits.

#### Milestone 5 — Production rehearsal

- Full 80-person test dataset.
- Six consecutive draws.
- Refresh recovery.
- Fullscreen failure test.
- Audio disabled test.
- HDMI/display disconnect/reconnect test.
- Actual event laptop and browser.
- Backup copy of production build.

### 6.4 Timeline

The event is planned for the **night of 27 August 2026**.

This is a short delivery window. Scope discipline is therefore critical.

Priority order before the event:

1. Correct participant import/validation.
2. Correct six-prize state machine and winner lifecycle.
3. Recovery and operator safeguards.
4. Presentation readability and stable reel animation.
5. Sound and celebration polish.
6. Optional enhancements only after a complete rehearsal passes.

A feature that threatens rehearsal readiness should be deferred even if it improves visual polish.

---

## 7. Key research findings

| Area | Finding | Recommendation |
|---|---|---|
| Winner selection | Browser provides strong randomness through `crypto.getRandomValues()` | Use it; keep animation separate |
| Offline | Core app needs no network | No backend/runtime Internet dependency |
| Direct file launch | `localStorage` semantics for `file:` URLs are undefined | Prefer localhost if reliable recovery matters |
| Recovery | Browser storage is convenient but locally editable | Use for recovery, not security; version state |
| Fullscreen | Requires permission/user activation and can exit on context changes | Make it explicit and non-critical |
| Audio | Browser autoplay policies can suspend Web Audio before interaction | Initialize/resume from operator gesture |
| Dual display | Same-origin browser contexts can communicate via `BroadcastChannel` | Consider for extended-display setup |
| Import | CSV is enough for a small participant pool | Avoid `.xlsx` complexity unless required |
| Branding | VPBank officially retains red/green prosperity identity with brighter green | Use green-dominant premium stage treatment |
| Slot metaphor | Mechanics support suspense, literal casino styling harms fit | Four reels, no gambling imagery |
| AI workflow | Structured context reduces agent drift | Research → PRD → Tech Design → AGENTS → small build passes |

---

## 8. Risks and mitigations

### Risk 1 — accidental duplicate draw

**Mitigation:** state machine, draw lock, disabled controls, idempotent draw action, tests.

### Risk 2 — refresh loses event progress

**Mitigation:** persist state after every committed winner; resume workflow; prefer stable localhost origin.

### Risk 3 — malformed participant list

**Mitigation:** validate before enabling live mode; report duplicates and invalid rows explicitly.

### Risk 4 — animation and official result diverge

**Mitigation:** winner is selected/committed first; animation receives an immutable winning code.

### Risk 5 — audience sees operator UI

**Mitigation:** presentation-specific layout or separate presentation window.

### Risk 6 — fullscreen fails

**Mitigation:** maximize-compatible presentation; fullscreen is enhancement, not a requirement for draw correctness.

### Risk 7 — sound does not start

**Mitigation:** explicit sound initialization after user gesture; mute-safe experience.

### Risk 8 — local state is modified

**Mitigation:** recognize that client-side storage is not tamper-proof; this is an internal event tool, not a regulated lottery system. Keep an append-style winner history in application state and optionally support export/backup.

### Risk 9 — casino aesthetic conflicts with corporate event

**Mitigation:** formalize the design rule in `AGENTS.md` and UI spec: slot mechanics only; VPBank aesthetics dominate.

### Risk 10 — Codex causes architectural/design drift

**Mitigation:** use PRD + Tech Design + canonical `AGENTS.md`; implement feature-by-feature; require review checklist completion.

---

## 9. Confirmed interview decisions

The Vibe-coder interview has now resolved the major product/setup questions:

1. **Event deadline:** night of **27 August 2026**.
2. **Distribution:** deploy as a website and send the MC a URL.
3. **Participant setup model:** default participant list is preloaded, but the MC may replace/edit it before the event starts.
4. **Default data storage:** participant defaults live in a project data file rather than being hard-coded into draw logic.
5. **Absent winner policy:** `Mark Absent & Redraw`.
6. **Winner lifecycle:** reveal produces a **Pending Winner**; MC chooses `Confirm Winner` or `Mark Absent & Redraw`.
7. **Recovery UX:** when an unfinished session exists, show `Resume Previous Session` / `Start New Session`.
8. **Display setup:** simple single-window Presentation Mode with mirrored audience display.
9. **Audio:** basic sound effects are included, with Sound On/Off; no background-music system is required.
10. **Winner-name presentation:** show the name when participant data contains one; otherwise omit it cleanly.
11. **Participant import:** support paste, CSV, and Excel `.xlsx`, with preview and validation before applying.

### Remaining implementation-level questions

These can be resolved during PRD reconciliation / Tech Design without another product interview unless they materially change scope:

- Exact hosting provider.
- Exact `.xlsx` parsing implementation.
- Exact saved-state schema and storage abstraction.
- Exact animation durations and audio cues.
- Whether a rehearsal/test mode fits before the deadline.
- Exact official participant/prize data filenames.

## 10. Recommended direction

Proceed with the custom application.

Do **not** pivot back to a generic lucky-draw website unless development time becomes severely constrained.

The best-fit MVP is:

- Browser-based.
- No backend.
- Hosted behind a shareable HTTPS URL.
- Modular during development.
- Client-side state for the MVP; no backend required.
- Four-digit participant codes.
- Six prizes.
- Secure browser RNG.
- Explicit state machine.
- Persistent recovery state with explicit Resume / Start New choice.
- Pending → Confirm / Absent & Redraw winner lifecycle.
- Single-window Operator / Presentation modes.
- Four vertical reels.
- VPBank green-led visual identity.
- Basic sound effects with Sound On/Off.
- Grand Prize-specific state.
- Strong rehearsal checklist.

The next workflow stage should turn these findings into the final PRD and then a technical design. Since a draft PRD already exists, it should be reconciled against this research rather than regenerated blindly.

---

## Handoff Context
<!-- Machine-readable summary for the next workflow step. Do not delete; the next prompt in the workflow reads this block. -->
- Stage: research
- App name: VPBank Lucky Draw
- User level: A
- Target platform: hosted web application
- Event: DPC Party H1.2026
- Event date: 2026-08-27 night
- Participants: approximately 80
- Ticket format: unique 4-digit code; leading zeros preserved
- Prize count: exactly 6
- Distribution: shareable website URL
- Backend: none required for MVP
- Default participant source: project data file
- Participant override: allowed before event start
- Import methods: paste, CSV, XLSX
- Import UX: preview + validation + explicit apply
- Winner RNG: crypto.getRandomValues()
- Winner repeat allowed: false
- Winner lifecycle: selected → revealed → pending → confirm OR mark absent and redraw
- Absent participant: excluded from all remaining prizes; voided attempt retained in history
- Recovery UX: Resume Previous Session / Start New Session
- Display topology: single-window presentation; mirrored event display
- Audio: basic effects; Sound On/Off; no background-music subsystem
- Winner name: display when present; omit cleanly when absent
- Visual direction: four-reel slot-machine mechanics with VPBank aesthetics
- Casino/gambling imagery: prohibited
- Priority: reliability and rehearsal readiness before visual polish
- Budget: near-zero runtime infrastructure cost; optional asset costs only if required
- Remaining product questions: none considered blocking for Deep Research
- Remaining implementation decisions: hosting provider, XLSX library/strategy, persistence schema, exact animation/audio tuning
- Source files: research-VPBankLuckyDraw.md
- Next step: Verification Echo → reconcile/approve PRD → Tech Design
