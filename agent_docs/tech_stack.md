# Tech Stack & Tools

- **Frontend:** React with TypeScript, built by Vite.
- **Backend:** None for the MVP.
- **Database:** None for the MVP.
- **Styling:** Project CSS/CSS modules or lightweight React styling; keep VPBank presentation tokens centralized and avoid unnecessary UI frameworks unless explicitly chosen later.
- **Authentication:** None. User accounts and authentication are out of scope.
- **Build Tool:** Vite.
- **Unit/Integration Tests:** Vitest.
- **E2E Tests:** Playwright.
- **XLSX Import:** Stable pinned browser-compatible `xlsx` parser, with SheetJS `xlsx` as the default candidate.
- **RNG:** Web Crypto API via `crypto.getRandomValues()` with rejection sampling.
- **Persistence:** Versioned `localStorage` using key `vpbank-lucky-draw:event-state`.
- **Audio:** Bundled local assets and/or Web Audio initialized after an operator gesture.
- **Hosting:** Vercel static deployment from GitHub.
- **Source Control:** Git + GitHub.

## Commands
- **Install:** `npm install`
- **Develop:** `npm run dev`
- **Test:** `npm run test`
- **Lint:** `npm run lint`
- **Build:** `npm run build`

Add a separate `npm run typecheck` command during scaffolding if it is not created automatically. Before feature completion, run typecheck, unit/integration tests, relevant Playwright checks, and build as appropriate.

## Project Structure
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

## Error Handling Pattern
```ts
export type AppResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string; details?: unknown };

export function parseParticipantCode(value: unknown): AppResult<string> {
  if (typeof value !== "string" && typeof value !== "number") {
    return { ok: false, message: "Participant code is required.", details: value };
  }

  const code = String(value).trim();
  if (!/^\d{4}$/.test(code)) {
    return { ok: false, message: "Participant code must be exactly four digits.", details: value };
  }

  return { ok: true, value: code };
}
```

This example is illustrative, not a full production implementation. Use this shape for domain/service boundaries so UI can show a safe message and tests can inspect developer details. Do not let raw parser, storage, audio, fullscreen, or import exceptions escape directly into React components.

## Styling & Component Examples
```tsx
import type { ParticipantValidationResult } from "../domain/types";

interface ValidationSummaryProps {
  result: ParticipantValidationResult;
  onApply: () => void;
}

export function ValidationSummary({ result, onApply }: ValidationSummaryProps) {
  const canApply = result.valid.length > 0 && result.duplicateRows.length === 0 && result.invalidRows.length === 0;

  return (
    <section aria-labelledby="validation-title" className="setup-panel">
      <h2 id="validation-title">Participant Validation</h2>
      <dl className="validation-grid">
        <div><dt>Rows received</dt><dd>{result.received}</dd></div>
        <div><dt>Valid participants</dt><dd>{result.valid.length}</dd></div>
        <div><dt>Duplicate codes</dt><dd>{result.duplicateRows.length}</dd></div>
        <div><dt>Invalid rows</dt><dd>{result.invalidRows.length}</dd></div>
      </dl>
      <button type="button" disabled={!canApply} onClick={onApply}>
        Apply Participants
      </button>
    </section>
  );
}
```

This component example is illustrative, not a canonical production implementation. Keep operator UI clear and safe. Keep presentation UI large, high-contrast, VPBank-branded, and free of setup/debug controls.
