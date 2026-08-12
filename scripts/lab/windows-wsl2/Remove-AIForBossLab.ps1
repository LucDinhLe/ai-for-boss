[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory)]
    [ValidateSet('AIForBossLab')]
    [string]$ConfirmName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$LabName = 'AIForBossLab'
if ($ConfirmName -ne $LabName) {
    throw "Confirmation must exactly match $LabName"
}

$names = @(& wsl.exe --list --quiet | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
if ($names -notcontains $LabName) {
    Write-Host "$LabName is not registered; nothing was removed."
    exit 0
}

if ($PSCmdlet.ShouldProcess($LabName, 'Unregister and permanently delete the dedicated WSL filesystem')) {
    & wsl.exe --terminate $LabName 2>$null

    & wsl.exe --unregister $LabName
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to unregister $LabName"
    }

    Write-Host "$LabName was unregistered. Its Linux filesystem cannot be recovered unless separately backed up."
}
