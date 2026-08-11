[CmdletBinding()]
param(
    [ValidatePattern('^AIForBossLab$')]
    [string]$LabName = 'AIForBossLab',

    [ValidateSet('Ubuntu-24.04')]
    [string]$Distribution = 'Ubuntu-24.04',

    [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'AIForBoss\Lab\WSL\AIForBossLab')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ExpectedOpenClawVersion = '2026.7.1-2'
$ScriptRoot = $PSScriptRoot
$RepoRoot = (Resolve-Path (Join-Path $ScriptRoot '..\..\..')).Path
$WslConfigPath = Join-Path $ScriptRoot 'wsl.conf'
$BootstrapPath = Join-Path $ScriptRoot 'bootstrap-lab.sh'
$RuntimeInputRoot = Join-Path $RepoRoot 'manifests\runtime\openclaw-lab'
$PackageJsonPath = Join-Path $RuntimeInputRoot 'package.json'
$WorkspaceConfigPath = Join-Path $RuntimeInputRoot 'pnpm-workspace.yaml'
$LockfilePath = Join-Path $RuntimeInputRoot 'pnpm-lock.yaml'
$EvidenceRoot = Join-Path $RepoRoot 'artifacts\feature-0.2\lab'

function Invoke-NativeChecked {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [Parameter(Mandatory)]
        [string[]]$ArgumentList
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE"
    }
}

function Get-WslDistributionNames {
    $output = & wsl.exe --list --quiet 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw 'Cannot enumerate WSL distributions.'
    }

    return @($output | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
}

function Stop-Lab {
    & wsl.exe --terminate $LabName 2>$null
    if ($LASTEXITCODE -eq 0) {
        return
    }

    $running = @(& wsl.exe --list --running --quiet 2>$null | ForEach-Object { ($_ -replace "`0", '').Trim() } | Where-Object { $_ })
    if ($running -contains $LabName) {
        throw "Failed to stop $LabName"
    }
}

function Send-FileToLab {
    param(
        [Parameter(Mandatory)]
        [string]$SourcePath,

        [Parameter(Mandatory)]
        [string]$DestinationPath,

        [ValidateSet('0644', '0700')]
        [string]$Mode = '0644'
    )

    if ($DestinationPath -notmatch '^/[A-Za-z0-9_./-]+$') {
        throw "Unsafe lab destination path: $DestinationPath"
    }

    $command = "cat > '$DestinationPath' && chmod $Mode '$DestinationPath'"
    $process = Start-Process -FilePath 'wsl.exe' -ArgumentList @(
        '--distribution', $LabName,
        '--user', 'root',
        '--', 'sh', '-lc', "`"$command`""
    ) -RedirectStandardInput $SourcePath -NoNewWindow -Wait -PassThru
    if ($process.ExitCode -ne 0) {
        throw "Cannot send $SourcePath to $DestinationPath; wsl.exe exited with $($process.ExitCode)"
    }
}

function Export-LabEvidence {
    param(
        [Parameter(Mandatory)]
        [string]$EvidenceFile
    )

    if ($EvidenceFile -notmatch '^[a-z0-9.-]+\.json$') {
        throw "Unsafe evidence filename: $EvidenceFile"
    }

    $source = "/var/lib/ai-for-boss-lab/evidence/$EvidenceFile"
    $lines = @(& wsl.exe --distribution $LabName --user root -- cat $source)
    if ($LASTEXITCODE -ne 0) {
        throw "Cannot export lab evidence: $EvidenceFile"
    }

    $destination = Join-Path $EvidenceRoot $EvidenceFile
    $text = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
    [System.IO.File]::WriteAllText($destination, $text, [System.Text.UTF8Encoding]::new($false))
}

if (-not (Get-Command wsl.exe -ErrorAction SilentlyContinue)) {
    throw 'WSL2 is not installed. This script will not enable Windows features automatically.'
}

foreach ($requiredFile in @($WslConfigPath, $BootstrapPath, $PackageJsonPath, $WorkspaceConfigPath, $LockfilePath)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required lab file is missing: $requiredFile"
    }
}

$resolvedInstallRoot = [System.IO.Path]::GetFullPath($InstallRoot)
$expectedParent = [System.IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'AIForBoss\Lab\WSL'))
if (-not $resolvedInstallRoot.StartsWith($expectedParent, [StringComparison]::OrdinalIgnoreCase)) {
    throw "InstallRoot must stay inside $expectedParent"
}

$existing = Get-WslDistributionNames
$labMayExist = $true
try {
if ($existing -contains $LabName) {
    $registrations = @(
        Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' |
            ForEach-Object { Get-ItemProperty $_.PSPath } |
            Where-Object { $_.DistributionName -eq $LabName }
    )
    if ($registrations.Count -ne 1) {
        throw "Cannot uniquely verify the registry entry for $LabName"
    }

    $actualBasePath = [System.IO.Path]::GetFullPath([string]$registrations[0].BasePath).TrimEnd([char[]]'\/')
    $expectedBasePath = $resolvedInstallRoot.TrimEnd([char[]]'\/')
    if (-not $actualBasePath.Equals($expectedBasePath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to modify $LabName because its BasePath is $actualBasePath, expected $expectedBasePath"
    }
    if ([int]$registrations[0].Version -ne 2) {
        throw "Refusing to modify $LabName because it is not WSL2"
    }

    Write-Host "Using existing dedicated distribution: $LabName"
}
else {
    New-Item -ItemType Directory -Path $resolvedInstallRoot -Force | Out-Null
    Write-Host "Downloading $Distribution into the dedicated lab path..."
    Invoke-NativeChecked -FilePath 'wsl.exe' -ArgumentList @(
        '--install', $Distribution,
        '--name', $LabName,
        '--location', $resolvedInstallRoot,
        '--version', '2',
        '--vhd-size', '32GB',
        '--no-launch',
        '--web-download'
    )
}

Invoke-NativeChecked -FilePath 'wsl.exe' -ArgumentList @(
    '--distribution', $LabName,
    '--user', 'root',
    '--', 'true'
)

Send-FileToLab -SourcePath $WslConfigPath -DestinationPath '/etc/wsl.conf' -Mode '0644'
Stop-Lab

Invoke-NativeChecked -FilePath 'wsl.exe' -ArgumentList @(
    '--distribution', $LabName,
    '--user', 'root',
    '--', 'sh', '-lc', '! findmnt --mountpoint /mnt/c >/dev/null 2>&1 && ! command -v cmd.exe >/dev/null 2>&1'
)

Send-FileToLab -SourcePath $BootstrapPath -DestinationPath '/root/bootstrap-ai-for-boss-lab.sh' -Mode '0700'
Invoke-NativeChecked -FilePath 'wsl.exe' -ArgumentList @(
    '--distribution', $LabName,
    '--user', 'root',
    '--', 'install', '-d', '-m', '0700', '/root/ai-for-boss-lab-input'
)
Send-FileToLab -SourcePath $PackageJsonPath -DestinationPath '/root/ai-for-boss-lab-input/package.json' -Mode '0644'
Send-FileToLab -SourcePath $WorkspaceConfigPath -DestinationPath '/root/ai-for-boss-lab-input/pnpm-workspace.yaml' -Mode '0644'
Send-FileToLab -SourcePath $LockfilePath -DestinationPath '/root/ai-for-boss-lab-input/pnpm-lock.yaml' -Mode '0644'
Invoke-NativeChecked -FilePath 'wsl.exe' -ArgumentList @(
    '--distribution', $LabName,
    '--user', 'root',
    '--', 'bash', '/root/bootstrap-ai-for-boss-lab.sh'
)

Invoke-NativeChecked -FilePath 'wsl.exe' -ArgumentList @(
    '--manage', $LabName,
    '--set-default-user', 'aifblab'
)

New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
foreach ($evidenceFile in @('smoke-report.json', 'dependency-tree.full.json', 'licenses.full.json')) {
    Export-LabEvidence -EvidenceFile $evidenceFile
}

$smoke = Get-Content -Raw (Join-Path $EvidenceRoot 'smoke-report.json') | ConvertFrom-Json
if ($smoke.versions.openclawPackage -ne $ExpectedOpenClawVersion) {
    throw "Unexpected OpenClaw package version in smoke report: $($smoke.versions.openclawPackage)"
}
}
finally {
    if ($labMayExist) {
        Stop-Lab
    }
}

Write-Host ''
Write-Host 'AI for Boss lab installed and stopped successfully.'
Write-Host "Distribution: $LabName"
Write-Host "Evidence: $EvidenceRoot"
Write-Host 'No provider account, API key, OAuth token or user data was used.'
