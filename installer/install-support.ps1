param(
  [Parameter(Mandatory=$true)][ValidateSet('Prepare','Commit','Verify','Activate','Remove')][string]$Action,
  [Parameter(Mandatory=$true)][string]$Root,
  [Parameter(Mandatory=$true)][ValidatePattern('^[0-9A-Za-z][0-9A-Za-z.-]{0,70}$')][string]$Version,
  [Parameter(Mandatory=$true)][string]$Manifest,
  [Parameter(Mandatory=$true)][string]$Desktop,
  [Parameter(Mandatory=$true)][string]$StartMenu,
  [long]$StatusWindow = 0
)
$ErrorActionPreference = 'Stop'
$signature = 'AI for Boss internal installer root v1'
$rootPath = [IO.Path]::GetFullPath($Root).TrimEnd('\')
$versionPath = Join-Path $rootPath ('versions\' + $Version)
$stagePath = Join-Path $rootPath ('staging\' + $Version)
$rootMarker = Join-Path $rootPath '.aifb-install-root'
$checkedDirectories = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
if ($StatusWindow) {
  Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class InstallProgress {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr FindWindowEx(IntPtr p, IntPtr after, string cls, string text);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr p, int id);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SendMessageTimeout(IntPtr p, uint m, IntPtr w, string text, uint flags, uint timeout, out IntPtr result);
  [DllImport("user32.dll")] static extern IntPtr SendMessageTimeout(IntPtr p, uint m, IntPtr w, IntPtr l, uint flags, uint timeout, out IntPtr result);
  public static void Update(long parent, string text, int percent) {
    IntPtr page = FindWindowEx(new IntPtr(parent), IntPtr.Zero, "#32770", null);
    IntPtr label = GetDlgItem(page, 1006), bar = GetDlgItem(page, 1004);
    IntPtr result;
    if (label != IntPtr.Zero) SendMessageTimeout(label, 12, IntPtr.Zero, text, 2, 100, out result);
    if (bar != IntPtr.Zero) { SendMessageTimeout(bar, 1030, IntPtr.Zero, new IntPtr(100), 2, 100, out result); SendMessageTimeout(bar, 1026, new IntPtr(percent), IntPtr.Zero, 2, 100, out result); }
  }
}
'@
}
function Hash-File([string]$file) {
  $stream = [IO.File]::OpenRead($file); $algorithm = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($algorithm.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
  finally { $algorithm.Dispose(); $stream.Dispose() }
}
function Assert-PlainPath([string]$value) {
  $full = [IO.Path]::GetFullPath($value)
  if ($full.StartsWith('\\') -or $full.Length -lt 4) { throw 'Chọn một thư mục cục bộ riêng cho ứng dụng' }
  $cursor = $full
  while ($cursor) {
    if ($checkedDirectories.Contains($cursor)) { break }
    # Direct attributes avoid two PowerShell provider calls per file. Only a
    # missing path is skipped; access errors and every reparse point still fail.
    try { $attributes = [IO.File]::GetAttributes($cursor) }
    catch [IO.FileNotFoundException] { $attributes = $null }
    catch [IO.DirectoryNotFoundException] { $attributes = $null }
    if ($null -ne $attributes) {
      if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Chọn thư mục cài đặt ngoài liên kết hoặc thư mục đồng bộ' }
      if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) { $null = $checkedDirectories.Add($cursor) }
    }
    $parent = [IO.Path]::GetDirectoryName($cursor)
    if ($parent -eq $cursor) { break }; $cursor = $parent
  }
}
function Owned-Path([string]$base, [string]$relative, [bool]$inspect = $true) {
  if (-not $relative -or $relative.Contains('\') -or $relative.Contains(':') -or $relative.StartsWith('/') -or $relative.Split('/') -contains '..' -or $relative.Split('/') -contains '.') { throw 'Đường dẫn trong gói không hợp lệ' }
  $full = [IO.Path]::GetFullPath([IO.Path]::Combine($base, $relative.Replace('/','\')))
  if (-not $full.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Tệp nằm ngoài thư mục phiên bản' }
  if ($inspect) { Assert-PlainPath $full }
  return $full
}
function Reuse-Core($payload) {
  $versions = Join-Path $rootPath 'versions'
  if (-not [IO.Directory]::Exists($versions)) { return }
  $previous = @(Get-ChildItem -LiteralPath $versions -Directory | Where-Object { $_.Name -ne $Version -and $_.Name -match '^[0-9A-Za-z][0-9A-Za-z.-]{0,70}$' } | Sort-Object LastWriteTime -Descending)
  foreach ($candidate in $previous) {
    Assert-PlainPath $candidate.FullName
    $proof = Join-Path $candidate.FullName '.aifb-payload.json'
    if (-not [IO.File]::Exists($proof)) { continue }
    Assert-PlainPath $proof
    $prior = Get-Content -LiteralPath $proof -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($prior.product -ne 'AI for Boss' -or $prior.version -ne $candidate.Name) { continue }
    Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class InstallLinks {
  [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
  public static extern bool CreateHardLink(string target, string source, IntPtr reserved);
}
'@
    $known = @{}; foreach ($item in $prior.files) { $known[$item.path] = $item.sha256 }
    $count = 0; $clock = [Diagnostics.Stopwatch]::StartNew(); $last = -1000
    foreach ($file in $payload.files) {
      if ($file.path -notmatch '^resources/(node_modules/|runtime/node/)') { continue }
      if ($known[$file.path] -ne $file.sha256) { continue }
      $source = Owned-Path $candidate.FullName $file.path
      if (-not [IO.File]::Exists($source)) { continue }
      if ((Hash-File $source) -ne $file.sha256) { continue }
      $target = Owned-Path $stagePath $file.path
      [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
      # The payload writer skips these verified hardlinks, never overwrites them.
      # Failed links fall back to normal extraction. Commit rehashes everything.
      if ([InstallLinks]::CreateHardLink($target, $source, [IntPtr]::Zero)) { $count++ }
      if ($StatusWindow -and $clock.ElapsedMilliseconds - $last -ge 500) {
        [InstallProgress]::Update($StatusWindow, ('Đang dùng lại lõi đã kiểm tra: ' + $count + ' tệp'), 0); $last = $clock.ElapsedMilliseconds
      }
    }
    break
  }
}
function Read-Payload {
  $data = Get-Content -LiteralPath $Manifest -Raw -Encoding UTF8 | ConvertFrom-Json
  if ($data.schemaVersion -ne 1 -or $data.product -ne 'AI for Boss' -or $data.version -ne $Version -or $data.files.Count -lt 3) { throw 'Thông tin bộ cài không khớp' }
  $names = @{}
  foreach ($file in $data.files) {
    if ($names.ContainsKey($file.path.ToLowerInvariant()) -or $file.sha256 -notmatch '^[a-f0-9]{64}$' -or $file.bytes -lt 0) { throw 'Danh sách tệp không hợp lệ' }
    $names[$file.path.ToLowerInvariant()] = $true
    # Validate manifest names here; inspect real paths immediately before each
    # copy/hash/delete operation instead of scanning the whole tree twice.
    $finalFile = Owned-Path $versionPath $file.path $false
    if ($Action -eq 'Prepare') {
      $stageFile = [IO.Path]::Combine($stagePath, $file.path.Replace('/','\'))
      foreach ($candidate in @($finalFile, $stageFile)) {
        if ($candidate.Length -ge 260 -or [IO.Path]::GetDirectoryName($candidate).Length -ge 248) {
          throw 'Đường dẫn cài đặt quá dài. Hãy dùng thư mục mặc định hoặc chọn thư mục ngắn hơn'
        }
      }
    }
  }
  if (-not $names.ContainsKey('ai-for-boss.exe') -or -not $names.ContainsKey('resources/app.asar') -or -not $names.ContainsKey('resources/runtime/node/node.exe')) { throw 'Gói thiếu giao diện hoặc lõi' }
  return $data
}
function Verify-Payload([string]$base, $payload) {
  # Keep the 36,000-file loop inside .NET, without repeated PowerShell provider
  # dispatch. Every file is still checked for reparse points, size and SHA256.
  Add-Type @'
using System;
using System.IO;
using System.Collections.Generic;
using System.Diagnostics;
using System.Security.Cryptography;
public static class InstallVerifier {
  public static void Verify(string root, string[] names, long[] sizes, string[] hashes, Action<int,long> progress) {
    root = Path.GetFullPath(root).TrimEnd('\\');
    var checkedDirs = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var clock = Stopwatch.StartNew(); long last = -1000;
    using (var algorithm = SHA256.Create()) {
      for (int i = 0; i < names.Length; i++) {
        string file = Path.GetFullPath(Path.Combine(root, names[i].Replace('/', '\\')));
        if (!file.StartsWith(root + "\\", StringComparison.OrdinalIgnoreCase)) throw new IOException("Payload path outside version");
        string cursor = file;
        while (!String.IsNullOrEmpty(cursor) && !checkedDirs.Contains(cursor)) {
          var attributes = File.GetAttributes(cursor);
          if ((attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("Payload contains a reparse point");
          if ((attributes & FileAttributes.Directory) != 0) checkedDirs.Add(cursor);
          cursor = Path.GetDirectoryName(cursor);
        }
        using (var stream = File.OpenRead(file)) {
          if (stream.Length != sizes[i] || !String.Equals(BitConverter.ToString(algorithm.ComputeHash(stream)).Replace("-", ""), hashes[i], StringComparison.OrdinalIgnoreCase))
            throw new IOException("Payload size or SHA256 mismatch");
        }
        if (progress != null && (clock.ElapsedMilliseconds - last >= 500 || i + 1 == names.Length)) {
          progress(i + 1, clock.ElapsedMilliseconds / 1000); last = clock.ElapsedMilliseconds;
        }
      }
    }
  }
}
'@
  $report = if ($StatusWindow) { [Action[int,long]] { param($count, $seconds)
    [InstallProgress]::Update($StatusWindow, ('Đang kiểm tra: ' + $count + '/' + $payload.files.Count + ' tệp — ' + $seconds + ' giây'), [int](100 * $count / $payload.files.Count))
  } } else { $null }
  [InstallVerifier]::Verify($base, [string[]]$payload.files.path, [long[]]$payload.files.bytes, [string[]]$payload.files.sha256, $report)
}
function Clear-OwnedFiles([string]$base, $payload, [bool]$onlyMatching) {
  if (-not (Test-Path -LiteralPath $base)) { return }
  Assert-PlainPath $base
  $directories = @{}
  foreach ($file in $payload.files) {
    $target = Owned-Path $base $file.path
    if (Test-Path -LiteralPath $target -PathType Leaf) {
      if (-not $onlyMatching -or (Hash-File $target) -eq $file.sha256) { Remove-Item -LiteralPath $target -Force }
    }
    $parent = [IO.Path]::GetDirectoryName($target)
    while ($parent.StartsWith($base + '\', [StringComparison]::OrdinalIgnoreCase)) { $directories[$parent] = $true; $parent = [IO.Path]::GetDirectoryName($parent) }
  }
  foreach ($directory in ($directories.Keys | Sort-Object Length -Descending)) {
    if ((Test-Path -LiteralPath $directory) -and @(Get-ChildItem -LiteralPath $directory -Force).Count -eq 0) { Remove-Item -LiteralPath $directory }
  }
  if (@(Get-ChildItem -LiteralPath $base -Force).Count -eq 0) { Remove-Item -LiteralPath $base }
}
function Shortcut([string]$file, [string]$target, [bool]$remove) {
  # Known desktop/Start-menu folders may legitimately be redirected by Windows.
  # We only touch the versioned link and verify its target before replacing/removing.
  $shell = New-Object -ComObject WScript.Shell
  if (Test-Path -LiteralPath $file) {
    $existing = $shell.CreateShortcut($file)
    if ($existing.TargetPath -ne $target) { if ($remove) { return }; throw 'Lối tắt cùng tên thuộc bản khác; đã giữ nguyên' }
    if ($remove) { Remove-Item -LiteralPath $file }; return
  }
  if ($remove) { return }
  $folder = Split-Path -Parent $file
  if (-not (Test-Path -LiteralPath $folder)) { New-Item -ItemType Directory -Path $folder | Out-Null }
  $link = $shell.CreateShortcut($file)
  $link.TargetPath = $target; $link.WorkingDirectory = Split-Path -Parent $target; $link.IconLocation = $target + ',0'
  $link.Description = 'AI for Boss ' + $Version + ' - Built on OpenClaw'; $link.Save()
  if ($shell.CreateShortcut($file).TargetPath -ne $target) { throw 'Chưa xác nhận được lối tắt mới' }
}
try {
  Assert-PlainPath $rootPath
  Assert-PlainPath $versionPath
  Assert-PlainPath $stagePath
  $payload = Read-Payload
  if (Test-Path -LiteralPath $rootMarker) {
    if ((Get-Content -LiteralPath $rootMarker -Raw).Trim() -ne $signature) { throw 'Thư mục không thuộc bộ cài AI for Boss' }
  } elseif ($Action -eq 'Prepare') {
    if ((Test-Path -LiteralPath $rootPath) -and @(Get-ChildItem -LiteralPath $rootPath -Force).Count -gt 0) { throw 'Chọn thư mục trống; không chọn thư mục tài liệu hoặc bản cài khác' }
    New-Item -ItemType Directory -Path $rootPath -Force | Out-Null
    Set-Content -LiteralPath $rootMarker -Value $signature -Encoding UTF8
  } else { throw 'Không tìm thấy thông tin sở hữu bộ cài' }
  $manifestCopy = Join-Path $versionPath '.aifb-payload.json'
  if ((Test-Path -LiteralPath $versionPath) -and (-not (Test-Path -LiteralPath $manifestCopy) -or (Hash-File $manifestCopy) -ne (Hash-File $Manifest))) { throw 'Thông tin sở hữu phiên bản không khớp; đã giữ nguyên' }
  switch ($Action) {
    'Prepare' {
      # NSIS routes an existing version directly to Verify before activation.
      if (Test-Path -LiteralPath $versionPath) { break }
      if (Test-Path -LiteralPath $stagePath) {
        $stageManifest = Join-Path $stagePath '.aifb-payload.json'
        $stageIntent = Join-Path $stagePath '.aifb-stage-intent.json'
        $ownedStage = @(Get-ChildItem -LiteralPath $stagePath -Force).Count -eq 0
        foreach ($proof in @($stageIntent, $stageManifest)) {
          if (Test-Path -LiteralPath $proof) {
            if ((Hash-File $proof) -ne (Hash-File $Manifest)) { throw 'Thông tin bản cài dở không khớp; đã giữ nguyên' }
            $ownedStage = $true
          }
        }
        if (-not $ownedStage) { throw 'Thư mục cài dở chưa có thông tin sở hữu; đã giữ nguyên để kiểm tra' }
        # Keep ownership proof throughout cleanup so a lock or interruption can
        # be retried safely without adopting an unrelated staging directory.
        Clear-OwnedFiles $stagePath $payload $false
        if (Test-Path -LiteralPath $stagePath) {
          foreach ($remaining in @(Get-ChildItem -LiteralPath $stagePath -Force)) {
            if ($remaining.FullName -notin @($stageIntent, $stageManifest)) { throw 'Thư mục cài dở có tệp khác; đã giữ lại để kiểm tra' }
          }
          foreach ($proof in @($stageIntent, $stageManifest)) { if (Test-Path -LiteralPath $proof) { Remove-Item -LiteralPath $proof } }
          Remove-Item -LiteralPath $stagePath
        }
      }
      New-Item -ItemType Directory -Path $stagePath -Force | Out-Null
      $drive = New-Object IO.DriveInfo([IO.Path]::GetPathRoot($rootPath))
      if ($drive.AvailableFreeSpace -lt ([long]$payload.totalBytes + 33554432)) { throw 'Chưa đủ dung lượng trống cho phiên bản mới' }
      Copy-Item -LiteralPath $Manifest -Destination (Join-Path $stagePath '.aifb-stage-intent.json')
      Reuse-Core $payload
    }
    'Commit' {
      if (Test-Path -LiteralPath $versionPath) { throw 'Phiên bản đã tồn tại; không ghi đè lõi' }
      $stageIntent = Join-Path $stagePath '.aifb-stage-intent.json'
      if (-not (Test-Path -LiteralPath $stageIntent) -or (Hash-File $stageIntent) -ne (Hash-File $Manifest)) { throw 'Chưa xác nhận được thư mục cài dở; đã giữ nguyên' }
      Verify-Payload $stagePath $payload
      New-Item -ItemType Directory -Path (Split-Path -Parent $versionPath) -Force | Out-Null
      Copy-Item -LiteralPath $Manifest -Destination (Join-Path $stagePath '.aifb-payload.json')
      Remove-Item -LiteralPath $stageIntent
      # Same-volume directory rename: do not enumerate/copy the verified tree
      # again through the PowerShell filesystem provider (36,000+ files).
      [IO.Directory]::Move($stagePath, $versionPath)
    }
    'Verify' { Verify-Payload $versionPath $payload }
    'Activate' {
      if (-not (Test-Path -LiteralPath $manifestCopy)) { throw 'Chưa xác nhận bản đã cài' }
      $target = Join-Path $versionPath 'AI-for-Boss.exe'
      $label = 'AI for Boss - ' + $Version + '.lnk'
      Shortcut (Join-Path $Desktop $label) $target $false
      Shortcut (Join-Path $StartMenu ('AI for Boss Internal\' + $label)) $target $false
      $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBossInternal-' + $Version
      New-Item -Path $key -Force | Out-Null
      $uninstallCommand = '"' + (Join-Path $rootPath ('Uninstall-' + $Version + '.exe')) + '"'
      foreach ($entry in @{DisplayName=('AI for Boss ' + $Version + ' (Internal)'); DisplayVersion=$Version; Publisher='AI for Boss'; InstallLocation=$versionPath; DisplayIcon=($target + ',0'); UninstallString=$uninstallCommand; QuietUninstallString=($uninstallCommand + ' /S')}.GetEnumerator()) { Set-ItemProperty -Path $key -Name $entry.Key -Value $entry.Value }
      Set-ItemProperty -Path $key -Name NoModify -Type DWord -Value 1
      Set-ItemProperty -Path $key -Name NoRepair -Type DWord -Value 1
      Set-ItemProperty -Path $key -Name EstimatedSize -Type DWord -Value ([int][Math]::Ceiling($payload.totalBytes / 1024))
    }
    'Remove' {
      if (-not (Test-Path -LiteralPath $manifestCopy)) { throw 'Thiếu thông tin sở hữu phiên bản; không xóa' }
      # Preflight every owned file before touching shortcuts or deleting anything.
      # A running build keeps its files locked; the installer never closes it.
      foreach ($file in $payload.files) {
        $target = Owned-Path $versionPath $file.path
        if (Test-Path -LiteralPath $target -PathType Leaf) {
          try { $handle = [IO.File]::Open($target, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None); $handle.Dispose() }
          catch { throw 'Bản này đang được dùng. Đóng AI for Boss rồi gỡ cài đặt lại' }
        }
      }
      $target = Join-Path $versionPath 'AI-for-Boss.exe'
      $label = 'AI for Boss - ' + $Version + '.lnk'
      Shortcut (Join-Path $Desktop $label) $target $true
      Shortcut (Join-Path $StartMenu ('AI for Boss Internal\' + $label)) $target $true
      Clear-OwnedFiles $versionPath $payload $true
      if (Test-Path -LiteralPath $manifestCopy) { Remove-Item -LiteralPath $manifestCopy }
      $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\AIforBossInternal-' + $Version
      if ((Get-ItemProperty -Path $key -ErrorAction SilentlyContinue).InstallLocation -eq $versionPath) { Remove-Item -LiteralPath $key }
    }
  }
  $completed = @{ Prepare='Đã kiểm tra thư mục'; Commit='Đã xác minh đầy đủ tệp'; Verify='Bản đã cài còn nguyên vẹn'; Activate='Đã tạo lối tắt và mục gỡ cài đặt'; Remove='Đã gỡ bản này, giữ dữ liệu và các bản khác' }
  Write-Output ($completed[$Action] + ' (' + $Version + ')'); exit 0
} catch { Write-Output $_.Exception.Message; exit 1 }
