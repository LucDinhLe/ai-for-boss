[CmdletBinding()]
param(
    [ValidatePattern('^AIForBossLab$')]
    [string]$LabName = 'AIForBossLab'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Invoke-WslCheck {
    param(
        [Parameter(Mandatory)]
        [string]$Command
    )

    & wsl.exe --distribution $LabName --user root -- sh -lc $Command
    if ($LASTEXITCODE -ne 0) {
        throw "Lab check failed: $Command"
    }
}

$names = @(& wsl.exe --list --quiet | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($names -notcontains $LabName) {
    throw "Dedicated WSL distribution not found: $LabName"
}

try {
    Invoke-WslCheck '! findmnt --mountpoint /mnt/c >/dev/null 2>&1'
    Invoke-WslCheck '! command -v cmd.exe >/dev/null 2>&1'
    Invoke-WslCheck 'test "$(id -un aifblab)" = "aifblab"'
    Invoke-WslCheck 'test "$(/opt/ai-for-boss-lab/toolchain/node-v24.19.0-linux-x64/bin/node --version)" = "v24.19.0"'
    Invoke-WslCheck 'test "$(PATH=/opt/ai-for-boss-lab/toolchain/node-v24.19.0-linux-x64/bin:/opt/ai-for-boss-lab/toolchain/pnpm-11.2.2/bin:/usr/bin:/bin pnpm --version)" = "11.2.2"'
    Invoke-WslCheck 'test "$(/opt/ai-for-boss-lab/toolchain/node-v24.19.0-linux-x64/bin/node --eval "console.log(require(\"/opt/ai-for-boss-lab/runtime/node_modules/openclaw/package.json\").version)")" = "2026.7.1-2"'
    Invoke-WslCheck 'test -s /var/lib/ai-for-boss-lab/evidence/smoke-report.json'
    Invoke-WslCheck 'test -s /var/lib/ai-for-boss-lab/evidence/dependency-tree.full.json'
    Invoke-WslCheck 'test -s /var/lib/ai-for-boss-lab/evidence/licenses.full.json'
}
finally {
    & wsl.exe --terminate $LabName 2>$null
    if ($LASTEXITCODE -ne 0) {
        $running = @(& wsl.exe --list --running --quiet 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
        if ($running -contains $LabName) {
            Write-Warning "Failed to stop $LabName after checks."
        }
    }
}

Write-Host 'AI for Boss lab checks passed and the lab is stopped.'
