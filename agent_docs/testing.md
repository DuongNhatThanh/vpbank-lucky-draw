# Testing Strategy

## Frameworks
- **Unit Tests:** Vitest.
- **Integration Tests:** Vitest.
- **E2E Tests:** Playwright.
- **Visual Verification:** Playwright screenshots at 1920x1080 for key presentation states.

## Rules & Requirements
- **Coverage:** Aim for high coverage on critical paths: draw engine, participant validation, event state machine, persistence/recovery, and keyboard/operator safety.
- **Before Commit:** Always run `npm run test` before verifying a task is complete. Also run lint, typecheck, build, and relevant Playwright tests for user-facing or state-machine changes.
- **Failures:** NEVER skip tests or mock out assertions to make a pipeline pass without Human approval. If an Agent breaks a test, the Agent must fix it.

## Execution
- Command to run all tests: `npm run test`
- Command to run lint checks: `npm run lint`
- Command to run type checks: `npm run typecheck`
- Command to run build verification: `npm run build`
- Command to run E2E tests once Playwright is configured: `npm run test:e2e`
- Command to run a single test file: `npm run test -- path/to/file.test.ts`

## Required Test Areas

### Unit Tests
- Draw engine selects only eligible participants.
- Secure index range works, including one eligible participant.
- Confirmed, absent, and pending participants are never selected.
- Participant code `0027` stays `0027`.
- Invalid length and nondigit participant codes are rejected.
- Duplicate participant codes are detected.
- Optional participant names are preserved.
- Setup cannot draw.
- Pending cannot advance to next prize.
- Confirm completes the prize.
- Absent returns to the same prize.
- Final confirmation completes the event.

### Invariant Simulation
- Repeatedly simulate events with about 80 participants and random absent decisions.
- Assert no confirmed duplicates.
- Assert absent participants never later win.
- Assert exactly six confirmed prize winners.
- Assert prize index stays valid.

### Integration Tests
- Pending winner saves and restores.
- Confirmed winner saves and restores.
- Absent participant saves and restores.
- Corrupt persisted data is rejected.
- Resume / Start New behavior preserves or clears state only with the correct confirmation.

### Playwright E2E
1. Normal six-prize event.
2. Absent -> redraw same prize.
3. Pending -> refresh -> Resume Previous Session.
4. Typing + Space does not draw.
5. Presentation Mode hides operator UI.

### Visual Verification
Capture and inspect 1920x1080 screenshots for:
- Idle / event opening.
- Prize ready.
- Reel spinning/stopped.
- Pending winner.
- Confirmed winner.
- Grand Prize.
