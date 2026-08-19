# AGENTS.md - Master Plan for VPBank Lucky Draw

<!--
Single source of truth for every AI coding assistant on this project.
Keep it lean - details live in the Context Files at the bottom. Update Current State and Roadmap as you build.
-->

## Project Overview & Stack
**App:** VPBank Lucky Draw
**Overview:** VPBank Lucky Draw is a hosted web application for DPC Party H1.2026. It lets the MC run exactly six prize draws from about 80 participants with unique four-digit ticket codes, then reveals each already-selected winning code through four vertical slot-machine-style reels. The goal is a safe, recoverable, VPBank-branded event experience for one mirrored browser window.
**Stack:** React + TypeScript + Vite, Vitest, Playwright, browser-compatible XLSX parser, Web Crypto API, versioned localStorage, bundled/Web Audio, Git + GitHub, Vercel static hosting.
**Critical Constraints:** Correctness and recoverability come before animation complexity. No backend, no database, no runtime AI service, no public participant directory, no analytics transmitting participant names, no casino/gambling imagery, strict TypeScript, near-zero infrastructure cost, hosted HTTPS URL for the event.

## Setup & Commands
Execute these commands for standard development workflows. Do not invent new package manager commands.
- **Setup:** `npm install`
- **Development:** `npm run dev`
- **Linting:** `npm run lint`
- **Type Check:** `npm run typecheck`
- **Testing:** `npm run test`
- **E2E Testing:** `npm run test:e2e` *(after Playwright is configured)*
- **Build:** `npm run build`

## Protected Areas
Do NOT modify these without explicit human approval:
- **Secrets:** NEVER commit `.env` files or hardcode API keys, tokens, or passwords. The MVP should need no secrets or environment variables.
- **Infrastructure:** Deployment workflows, Vercel/GitHub configuration, and any future infrastructure files.
- **Database Migrations:** No database is planned for the MVP. Do not add one or create migrations without approval.
- **Third-Party Integrations:** Do not add analytics, auth, email/SMS, payment, remote logging, or runtime AI integrations.

## Coding Conventions
- **Formatting:** Use the project's configured TypeScript, ESLint, and formatting commands. New code should pass lint, typecheck, tests, and build before being called complete.
- **Architecture:** layered
- **Testing:** All new utilities get unit tests. Core user flows get integration tests.
- **Type Safety:** Use strict typing. Avoid `any`; define precise interfaces or use `unknown`.

## How I Should Think
1. **Understand Intent First:** Identify the user's actual event need and the current phase before making changes.
2. **Ask If Unsure:** If a choice could affect the live event or data safety, ask ONE specific question.
3. **Plan Before Coding:** Propose a brief plan and wait for approval before coding. If the tool has a plan/reflect mode, use it.
4. **Execute Incrementally:** Build one feature at a time. Keep changes small enough to review.
5. **Verify After Changes:** Run tests, linting, build, or manual browser checks after each logical change; fix failures before moving on.
6. **Protect the Draw:** Winner selection, eligibility, and persistence rules are more important than visual polish.
7. **Remember in Files:** Update `MEMORY.md` with current state, decisions, known issues, and completed milestones.
8. **Use Subagents If Available:** If the tool supports parallel agents, use them for exploration or test checks only after assigning clear scope and requiring a plan before edits.

## What NOT To Do
- Do NOT delete files without explicit confirmation.
- Do NOT add a backend, database, authentication, analytics, or runtime AI service for the MVP.
- Do NOT add features not in the current phase.
- Do NOT skip tests for "simple" changes.
- Do NOT bypass failing tests or pre-commit hooks.
- Do NOT use deprecated libraries or patterns.
- Do NOT use `Math.random()` for official winner selection.
- Do NOT let UI or animation choose, change, or mutate the official winner.
- Do NOT use casino/gambling imagery, jackpot language, coins, chips, 777 symbolism, pull levers, or dominant casino red/gold styling.

## Engineering Constraints
- **Type Safety:** Keep TypeScript strict. Avoid `any`; use precise types, `unknown`, and type guards for external input.
- **Domain Safety:** Winner selection, eligibility, prize progression, pending/confirmed/absent state, and invariants live in pure TypeScript domain/state modules, not React components.
- **Runtime Validation:** Validate participant imports, persisted recovery state, and any external data before applying them.
- **Persistence Discipline:** Persist important state before animation or celebration effects. Recovery must validate invariants before resuming.
- **Library Governance:** Check `package.json` and `agent_docs/tech_stack.md` before adding dependencies. Keep dependencies minimal, pinned, and frozen before final rehearsals.
- **Workflow Discipline:** Plan, execute one feature, verify, then update memory. If verification fails, fix it before continuing.

## Current State
**Last Updated:** 2026-08-19
**Working On:** Project setup - nothing built yet
**Recently Completed:** Research, PRD, Technical Design, and agent instruction generation.
**Blocked By:** None

## Roadmap

### Phase 1: Foundation
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

### Phase 2: Core Features
- [ ] P0-1 - Participant Setup, Import & Validation
- [ ] P0-2 - Reliable Six-Prize Draw Engine
- [ ] P0-3 - Pending Winner / Confirm / Absent & Redraw
- [ ] P0-4 - VPBank Presentation Experience
- [ ] P0-5 - Live-Event Safety, Progress & Recovery

### Phase 3: Polish
- [ ] Basic sound effects with Sound On/Off
- [ ] Confetti/celebration polish
- [ ] Grand Prize visual refinement
- [ ] Large-screen 1920x1080 presentation review
- [ ] Mobile/responsive sanity pass for operator controls

### Phase 4: Launch
- [ ] Security pass (see `REVIEW-CHECKLIST.md`)
- [ ] Production build passes
- [ ] Deploy to Vercel production HTTPS URL
- [ ] Run at least three consecutive full rehearsals
- [ ] Rehearse Absent & Redraw and Refresh & Resume
- [ ] Freeze dependencies before final rehearsals
- [ ] Launch checklist for 2026-08-27 night event

## Context Files
Load these only when needed - progressive disclosure keeps context lean:
- `agent_docs/tech_stack.md` - Stack details, libraries, setup commands
- `agent_docs/code_patterns.md` - Architecture and code style rules
- `agent_docs/project_brief.md` - Product vision and conventions
- `agent_docs/product_requirements.md` - Feature list and user stories
- `agent_docs/testing.md` - Test strategy and commands
- `MEMORY.md` - Session memory: decisions, known issues, active goal
- `REVIEW-CHECKLIST.md` - Definition of done before marking work complete
- `specs/` - Feature specs and handoff notes created during the build
