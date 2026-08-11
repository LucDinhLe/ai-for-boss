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

**Gate 0, Feature 0.3 — Capability and threat model is complete with local
contract verification.** Independent senior platform/security review remains a
Gate 0 requirement. The next permitted feature is **0.4 — App shell and
cross-platform CI**, but it must be opened in a new one-feature session with its
own active Feature Spec before any change.

Feature 0.4 may create the empty Electron app shell, sandboxed renderer,
minimal preload boundary, placeholder onboarding state and CI build matrix. It
must consume the Feature 0.3 capability/source/threat contracts.

Do not add live OAuth/provider implementations, production Gateway supervision,
installer/updater release logic, host execution, sensitive browser actions,
real credentials or product sandbox claims during Feature 0.4. The sandbox
decision remains Feature 0.6.

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
