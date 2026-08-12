# Feature 0.2 WSL2 lab

This lab installs a pinned OpenClaw candidate in a dedicated Ubuntu 24.04 WSL2 distribution named `AIForBossLab`.

## Safety boundary

- The distribution is stored under `%LOCALAPPDATA%\AIForBoss\Lab\WSL\AIForBossLab`, outside OneDrive and outside existing AI Coworker/OpenClaw profiles.
- Windows drive automount and Windows executable interop are disabled before any npm package is installed.
- CLI smoke commands run inside a temporary Linux network namespace with no network interface.
- Gateway contract smoke brings up only the loopback interface, starts a real Gateway with an ephemeral in-memory token, calls `health`, then destroys the temporary state.
- The distro is terminated after installation and tests.
- No OAuth, API key, provider account, model call or user data is used.

WSL2 still shares the host kernel and has network access while downloading dependencies. This is a contained development lab, not the cross-platform product sandbox decision required by Feature 0.6.

## Operator flow

Run from an elevated PowerShell only after reviewing the scripts:

```powershell
.\scripts\lab\windows-wsl2\Install-AIForBossLab.ps1
.\scripts\lab\windows-wsl2\Test-AIForBossLab.ps1
```

The install script creates a smoke report, a Gateway contract report, a full pnpm dependency tree and a transitive license inventory under `artifacts/feature-0.2/lab/`, then stops the distro. The baseline CycloneDX SBOM is tracked separately under `docs/licenses/`. The script is safe to rerun against the same named lab; it never overwrites a differently named distro.

## Rollback

Unregistering a WSL distro permanently deletes its Linux filesystem. The removal script therefore requires an exact name and PowerShell confirmation:

```powershell
.\scripts\lab\windows-wsl2\Remove-AIForBossLab.ps1 -ConfirmName AIForBossLab
```

Do not run removal as part of ordinary tests.
