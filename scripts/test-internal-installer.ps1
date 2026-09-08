param(
  [Parameter(Mandatory=$true)][string]$Setup,
  [Parameter(Mandatory=$true)][string]$Evidence,
  [string]$Root
)
$ErrorActionPreference = 'Stop'
$setupPath = [IO.Path]::GetFullPath($Setup)
$manifest = Get-Content -LiteralPath ($setupPath + '.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($manifest.product -ne 'AI for Boss' -or $manifest.classification -ne 'experimental-internal' -or $manifest.version -notmatch '^[0-9A-Za-z][0-9A-Za-z.-]{0,70}$') { throw 'Expected an internal installer receipt' }
if ((Get-FileHash -LiteralPath $setupPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $manifest.installerSha256) { throw 'Installer digest mismatch' }
$version = $manifest.version
$qaRoot = if ($Root) { [IO.Path]::GetFullPath($Root) } else { Join-Path ([IO.Path]::GetTempPath()) ('afqa-' + [Guid]::NewGuid().ToString('N').Substring(0,8)) }
$tempRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
if (-not $qaRoot.StartsWith($tempRoot + '\', [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $qaRoot)) { throw 'QA root must be a new folder below the Windows temporary directory' }
$versionPath = Join-Path $qaRoot ('versions\' + $version)
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBossInternal-' + $version
if (Test-Path -LiteralPath $uninstallKey) { throw 'An uninstall registration for this version already exists; QA will not replace it' }
$label = 'AI for Boss - ' + $version + '.lnk'
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) $label
$startLink = Join-Path ([Environment]::GetFolderPath('Programs')) ('AI for Boss Internal\' + $label)
foreach ($link in @($desktopLink, $startLink)) { if (Test-Path -LiteralPath $link) { throw 'A shortcut for this version already exists; QA will not replace it' } }
$receipt = [ordered]@{ schemaVersion=1; product='AI for Boss'; version=$version; installerSha256=$manifest.installerSha256; fixture='real compiled installer; no application launch or provider account'; root=$qaRoot; startedAt=[DateTime]::UtcNow.ToString('o'); phases=@(); status='running'; retainedForeignFiles=@() }
$evidencePath = [IO.Path]::GetFullPath($Evidence)
New-Item -ItemType Directory -Path (Split-Path -Parent $evidencePath) -Force | Out-Null
function Save-Receipt { $receipt | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $evidencePath -Encoding UTF8 }
function Assert-True([bool]$condition, [string]$message) { if (-not $condition) { throw $message } }
function Run-Installer([string]$name, [string]$executable, [string[]]$arguments) {
  $timer = [Diagnostics.Stopwatch]::StartNew()
  $process = Start-Process -FilePath $executable -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
  $timer.Stop()
  $receipt.phases += [ordered]@{ name=$name; exitCode=$process.ExitCode; elapsedMs=$timer.ElapsedMilliseconds }
  Save-Receipt
  Assert-True ($process.ExitCode -eq 0) ($name + ' failed: ' + $process.ExitCode)
}
function Verify-KeyFiles {
  foreach ($relative in @('AI-for-Boss.exe','resources/app.asar','resources/runtime/node/node.exe','resources/node_modules/openclaw/package.json')) {
    $expected = $manifest.files | Where-Object path -eq $relative
    Assert-True ($null -ne $expected) ('Missing manifest entry: ' + $relative)
    $file = Join-Path $versionPath $relative.Replace('/','\')
    Assert-True ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -eq $expected.sha256) ('Installed digest mismatch: ' + $relative)
  }
}
function Verify-Shortcuts {
  $shell = New-Object -ComObject WScript.Shell
  $target = Join-Path $versionPath 'AI-for-Boss.exe'
  foreach ($link in @($desktopLink, $startLink)) {
    Assert-True (Test-Path -LiteralPath $link) 'Installed shortcut missing'
    Assert-True ($shell.CreateShortcut($link).TargetPath -eq $target) 'Installed shortcut target mismatch'
  }
}
function Verify-Registration {
  $entry = Get-ItemProperty -LiteralPath $uninstallKey
  $command = '"' + (Join-Path $qaRoot ('Uninstall-' + $version + '.exe')) + '"'
  Assert-True ($entry.InstallLocation -eq $versionPath -and $entry.DisplayVersion -eq $version -and $entry.Publisher -eq 'AI for Boss') 'Apps & Features metadata mismatch'
  Assert-True ($entry.UninstallString -eq $command -and $entry.QuietUninstallString -eq ($command + ' /S')) 'Uninstall commands mismatch'
  Assert-True ($entry.DisplayIcon -eq ((Join-Path $versionPath 'AI-for-Boss.exe') + ',0') -and $entry.NoModify -eq 1 -and $entry.NoRepair -eq 1) 'Apps & Features icon/options mismatch'
}
Save-Receipt
try {
  Run-Installer 'install' $setupPath @('/S', ('/D=' + $qaRoot))
  Verify-KeyFiles; Verify-Shortcuts; Verify-Registration
  $ownedManifest = Join-Path $versionPath '.aifb-payload.json'
  $beforeManifest = (Get-FileHash -LiteralPath $ownedManifest -Algorithm SHA256).Hash
  $exeTimestamp = (Get-Item -LiteralPath (Join-Path $versionPath 'AI-for-Boss.exe')).LastWriteTimeUtc.Ticks
  $prior = Join-Path $qaRoot 'versions\qa-prior-preserved'
  New-Item -ItemType Directory -Path $prior | Out-Null
  $priorFile = Join-Path $prior 'prior-sentinel.txt'; $foreignFile = Join-Path $versionPath 'foreign-sentinel.txt'
  Set-Content -LiteralPath $priorFile -Value 'prior version must remain' -Encoding UTF8
  Set-Content -LiteralPath $foreignFile -Value 'foreign document must remain' -Encoding UTF8
  Run-Installer 'reinstall-verifies-every-payload-file' $setupPath @('/S', ('/D=' + $qaRoot))
  Assert-True ((Get-FileHash -LiteralPath $ownedManifest -Algorithm SHA256).Hash -eq $beforeManifest) 'Reinstall changed manifest'
  Assert-True ((Get-Item -LiteralPath (Join-Path $versionPath 'AI-for-Boss.exe')).LastWriteTimeUtc.Ticks -eq $exeTimestamp) 'Reinstall rewrote executable'
  Verify-KeyFiles; Verify-Shortcuts; Verify-Registration
  $uninstaller = Join-Path $qaRoot ('Uninstall-' + $version + '.exe')
  Run-Installer 'uninstall-owned-version-normal-self-copy' $uninstaller @('/S')
  # The initial NSIS stub can exit before its temporary copy. Verify completion,
  # not just that initial exit code, before recording a successful uninstall.
  $deadline = [DateTime]::UtcNow.AddMinutes(5)
  while (((Test-Path -LiteralPath $uninstallKey) -or (Test-Path -LiteralPath $desktopLink) -or (Test-Path -LiteralPath $startLink) -or (Test-Path -LiteralPath (Join-Path $versionPath 'AI-for-Boss.exe')) -or (Test-Path -LiteralPath $uninstaller)) -and [DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds 250 }
  foreach ($file in @($priorFile, $foreignFile)) { Assert-True (Test-Path -LiteralPath $file) 'Uninstall removed a foreign or prior-version sentinel' }
  foreach ($link in @($desktopLink, $startLink)) { Assert-True (-not (Test-Path -LiteralPath $link)) 'Uninstall retained an owned shortcut' }
  Assert-True (-not (Test-Path -LiteralPath $uninstallKey)) 'Uninstall retained its Apps & Features entry'
  Assert-True (-not (Test-Path -LiteralPath $uninstaller)) 'Uninstall retained its original uninstaller executable'
  foreach ($entry in $manifest.files) { Assert-True (-not (Test-Path -LiteralPath (Join-Path $versionPath $entry.path.Replace('/','\')))) ('Uninstall retained owned payload: ' + $entry.path) }
  $receipt.retainedForeignFiles = @($priorFile, $foreignFile)
  $receipt.status = 'passed'; $receipt.completedAt = [DateTime]::UtcNow.ToString('o')
  Save-Receipt
  Write-Output ('Installer QA passed: ' + $evidencePath)
} catch {
  $receipt.status = 'failed'; $receipt.error = $_.Exception.Message; $receipt.completedAt = [DateTime]::UtcNow.ToString('o'); Save-Receipt
  throw
}
