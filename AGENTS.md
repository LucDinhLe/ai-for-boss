# AGENTS.md — AI for Boss

## Session startup

Before making changes, read these files completely:

1. `docs/governance/AI-FOR-BOSS-BUILD-RULES.md`
2. `docs/governance/AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md`
3. `DECISIONS.md`
4. `RISKS.md`
5. The active file under `docs/feature-specs/`

Stop if any required file is missing, its governance hash fails, or the requested work crosses the active gate.

## Authority

- Product Owner: Lê Đình Lực.
- The Build Rules govern product decisions and release gates.
- The Master Execution Plan governs implementation order.
- `DECISIONS.md` records approved consequential choices.
- If documents conflict, the Build Rules win.

## Current scope

**Beta 0 is merged into `main` at `3675ded`.** The app supervises a real
OpenClaw Gateway, holds a host-owned device identity, speaks to the Gateway
through the published `@openclaw/gateway-client`, and renders one chat window
over a closed IPC bridge. Windows runs the Gateway natively — no Linux
subsystem — proven on windows-latest, macos-14 and ubuntu-latest.

**In progress: the Connect screen** on `feature/connect-screen`. The Feature
Spec is `docs/feature-specs/0008-connect-screen.md`. It drives OpenClaw's own
`openclaw.setup.*` flow from a second, admin-scoped connection held in the main
process (D-0021), and renders whatever provider catalogue the Gateway reports
rather than a list of its own (D-0022).

Gate 0 documents and contracts are closed; independent senior platform/security
review is still an open Gate 0 requirement. The candidate train
`oc-2026.9.1-candidate.1` is not the locked release train and must not be
described as one.

Do not add installer or updater logic, real Advisor orchestration, tools,
approvals, browser, terminal, plugins, skills or project management in this
feature. The sandbox defaults from D-0018 stay closed, and `config.*`,
`secrets.*` and every other admin family stay blocked even on the setup
channel.

## Build discipline

- One feature per working session.
- Write or update the Feature Spec before code.
- State assumptions, inputs, outputs, edge cases and acceptance criteria.
- Add and run tests for each change.
- Review security, privacy and blast radius before commit.
- Create a recoverable commit only after tests pass.
- Update `CHANGELOG.md`, `DECISIONS.md` and `RISKS.md` when relevant.

## Security rules

- Never commit secrets, tokens, cookies, credentials, personal data or production data.
- Use dedicated test accounts with minimal privileges and spending limits for future live-auth tests.
- Never use the Product Owner's primary ChatGPT, Claude, Google or GitHub account as a CI fixture.
- Never read or write OpenClaw private state files directly.
- Never enable host exec, elevated access or sensitive browser actions before the sandbox gate passes.
- Never weaken Electron security with remote debugging, disabled sandboxing or disabled web security in production.

## File editing and Git

- Preserve unrelated user changes.
- Prefer small, reviewable patches.
- Branch names use `feature/<id>-<slug>`, `fix/<slug>` or `docs/<slug>`.
- Commit messages use Conventional Commits.
- Do not force-push `main`.
- Do not merge a feature whose checks fail.

## Definition of done

A feature is done only when its acceptance criteria pass, automated and manual checks pass, security/privacy/blast-radius reviews are recorded, documentation is current, no secret is present and a rollback path exists.
