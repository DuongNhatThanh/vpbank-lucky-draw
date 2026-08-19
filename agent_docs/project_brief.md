# Project Brief

- **Product vision:** A safe, hosted, VPBank-branded lucky draw web app that runs exactly six prize draws and reveals each predetermined four-digit winning code through premium vertical reels.
- **Target Audience:** Primary: MC/event operator. Secondary: DPC Party H1.2026 audience. Setup user: event organizer preparing participants, prizes, display, audio, and rehearsal.

## Conventions
- **Naming:** camelCase for files, functions, and variables; PascalCase for React components/classes; UPPER_SNAKE_CASE for constants and env vars.
- **File Structure:** Follow the Tech Design structure. Keep pure draw/state logic in `src/domain/` and `src/state/`; keep browser APIs such as persistence, import, audio, and fullscreen in `src/services/`; keep operator and presentation UI separated under `src/components/`.

## Key Principles
- Ship the simplest possible solution that safely runs the event.
- Correctness, operator safety, recovery, and rehearsal readiness outrank animation polish.
- Select and persist the official winner before animation begins.
- Animation, sound, fullscreen, and celebration effects must never change the official result.
- Use four-reel slot-machine mechanics with VPBank aesthetics; do not use casino or gambling imagery.
- Keep the app static-hosted, client-side, and near-zero cost unless the approved PRD changes.
