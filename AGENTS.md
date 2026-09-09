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

**Beta 0 — supervised OpenClaw runtime and one chat window** is in progress on
`experiment/beta-0`, from the merge of Feature 0.5 and Feature 0.6 at `8f43070`.
The Feature Spec is `docs/feature-specs/0007-beta-0-supervised-openclaw.md`.

Gate 0 work is merged: Feature 0.4 contains the Electron shell, sandboxed
renderer and experimental CI package matrix; Feature 0.5 contains the fixture
first-run journey, now living at `apps/desktop/src/first-run/`; Feature 0.6
contains the sandbox ADR and probe. Independent senior platform/security review
is still an open Gate 0 requirement.

Beta 0 adds the Gateway Supervisor, host-owned device identity, the adapter over
the published `@openclaw/gateway-client`, a closed IPC bridge and a single chat
window. It runs the `oc-2026.9.1-candidate.1` candidate train, which is not the
locked release train and must not be described as one.

Do not add installer or updater logic, provider OAuth or API keys, agent runtime
selection, real Advisor orchestration, tools, approvals, browser, terminal,
plugins, skills or project management during beta 0. The sandbox defaults from
D-0018 stay closed.

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

Current scope0050: Owner authorizes merging preview source/history/releases into this repository, making it public after privacy review, then deleting preview. Current application source is beta36; earlier feature documents are historical. Preserve credentials, immutable core and profile boundaries. See docs/feature-specs/0050-repository-consolidation.md.
