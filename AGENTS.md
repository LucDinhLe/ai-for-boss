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

**Gate 0, Feature 0.6 — Sandbox feasibility ADR and fixture-only spike** is the
active scope on `feature/0.6-sandbox-feasibility`, based on the verified Feature
0.5 checkpoint `cf5edc5`. The active Feature Spec is
`docs/feature-specs/0006-sandbox-feasibility.md`.

Feature 0.6 compares local managed containers, remote OpenShell/SSH and native
OS restrictions. Its policy, probe and tests may prove fail-closed contract
logic, platform-presence hints and temporary-fixture containment only. They do
not prove real sandbox isolation or make an execution backend production-ready.

Keep product host execution, elevated execution, sensitive browser automation,
unrestricted network, arbitrary workspace mounts and credential injection
blocked. Do not install or start Docker, OpenShell, SSH hosts, VMs, services or
system software without explicit approval. Do not implement Supervisor, Gateway,
OAuth or Feature 1.1 in this working session. Senior platform/security review
and Product Owner backend acceptance remain Gate 0 requirements.

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
