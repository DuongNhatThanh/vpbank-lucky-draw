# Product Requirements

> Fill this in from the PRD (`docs/PRD-*.md`). This is the agent's quick-reference version - keep it short and current.

## Product Summary
- **Product:** VPBank Lucky Draw
- **One-liner:** Hosted web app for DPC Party H1.2026 that runs six no-repeat prize draws from valid four-digit participant codes and reveals each pending winner through four vertical reels.
- **Target users:** MC/event operator, event audience, and setup organizer.

## User Stories
- As an MC/event operator, I want to open a shared URL, verify participants, start each draw safely, confirm present winners, handle absent winners, and recover after refresh so that I can finish all six prizes without technical knowledge.
- As an audience member, I want to clearly see the current prize, draw progress, winning four-digit code, winner name when available, and Grand Prize status so that the event feels understandable and exciting.
- As an event organizer, I want to prepare default participant data, confirm six prizes, rehearse the full flow, and send the deployed URL to the operator so that the live event is ready before 27 August 2026.

## Feature List (MoSCoW)

### Must Have
- [ ] P0-1 - Participant Setup, Import & Validation: default participant data, paste/manual input, CSV import, XLSX import, validation summary, preview before Apply, explicit Apply, four-digit code preservation, duplicate/invalid reporting, configuration lock after first draw.
- [ ] P0-2 - Reliable Six-Prize Draw Engine: exactly six prizes, participant-record selection from eligible pool, `crypto.getRandomValues()`, leading-zero preservation, confirmed/absent/pending exclusion, double-draw prevention, animation-independent result.
- [ ] P0-3 - Pending Winner / Confirm / Absent & Redraw: reveal creates Pending Winner, Confirm commits official result and completes prize, Mark Absent records voided attempt and redraws the same prize, all states recover after refresh.
- [ ] P0-4 - VPBank Presentation Experience: single-window Presentation Mode, four vertical reels, sequential stopping, dominant winning number, conditional winner name, Grand Prize treatment, sound effects with Sound On/Off, fullscreen support, no casino imagery.
- [ ] P0-5 - Live-Event Safety, Progress & Recovery: configuration locks, safe shortcuts, disabled draw while active, Next Prize only after confirmation, no Prize 7, reset confirmation, persistent local recovery, Resume Previous Session / Start New Session.

### Should Have
- [ ] At least three consecutive full rehearsals before the event, including one Mark Absent & Redraw and one Refresh -> Resume Previous Session scenario.
- [ ] Production deployment to a Vercel HTTPS URL with no secrets or backend services.

### Could Have
- [ ] Rehearsal/Test Mode isolated from production state.
- [ ] Export results to CSV.
- [ ] Session backup import/export.
- [ ] Dedicated opening animation.
- [ ] Between-prize transitions.
- [ ] Event-complete six-winner summary.

### Won't Have (this version)
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

## Success Metrics
- Primary: On the night of 27 August 2026, the MC completes 6/6 prize draws end-to-end without a program-interrupting error, duplicate winner, or unrecoverable state loss.
- Secondary: Before the event, the application passes at least 3 consecutive full rehearsals, each with approximately 80 participants and all six prizes.
- Rehearsal coverage: Across rehearsals, test at minimum one Mark Absent & Redraw and one Refresh -> Resume Previous Session.
- Rehearsal failure conditions: winner duplication, unrecoverable state, wrong prize advancement, inconsistent eligibility, or need for manual code/data repair.

## Out of Scope
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

## UI/UX Requirements
- Design vibe: Premium, Modern, Exciting, Trustworthy, VPBank-branded.
- Core design rule: Slot-machine mechanics, VPBank aesthetics.
- Audience hierarchy: current prize, four-digit draw/winning number, winner, event identity, secondary decoration.
- Operator hierarchy: current state/current prize, primary allowed action, participant validity, prize progress, history, configuration.
- Presentation title: DPC Party H1.2026.
- Brand: official VPBank logo preserved, VPBank green dominates, red is a controlled accent, white supports high-contrast typography, champagne/gold is restrained and Grand-Prize-oriented.
- Prohibited: jackpot language, chips, coins, 777 symbolism, pull levers, dominant casino red/gold styling, or other casino/gambling visual language.

## Timeline and Constraints
- Event date: 2026-08-27 night.
- Target launch: production-ready before 2026-08-27 including rehearsals.
- Budget: free / near-zero runtime infrastructure cost; optional asset costs only if required.
- Priority order: correctness -> operator safety -> recovery -> presentation -> animation -> polish.
