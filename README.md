# VPBank Lucky Draw

Hosted React + TypeScript + Vite application for the VPBank Lucky Draw MVP.

The operator runs six prize draws for four-digit lucky numbers. Official winners are selected and persisted in the browser before the audience reveal. The app is designed for one designated operator laptop and browser profile.

## Local Setup

```bash
npm install
npm run dev
```

## Canonical Commands

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

## Production Readiness

- Vercel should use `npm run build` with `dist` as the output directory.
- Recovery uses versioned `localStorage` on the current device/browser profile.
- Recovery is not synchronized across laptops, browsers, or phones.
- Runtime draw logic continues after assets are loaded if the network is later unavailable; refreshing offline still depends on the host serving the app assets.

## Rehearsal Documents

- [Launch checklist](docs/LAUNCH-CHECKLIST.md)
- [Operator runbook](docs/OPERATOR-RUNBOOK.md)

## Notes

Read `AGENTS.md` first. Implementation details live in `agent_docs/`.
