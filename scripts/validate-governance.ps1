$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$failures = [System.Collections.Generic.List[string]]::new()

function Add-Failure([string]$message) {
  $failures.Add($message)
}

$requiredFiles = @(
  'README.md',
  'AGENTS.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'DECISIONS.md',
  'RISKS.md',
  'docs/feature-specs/TEMPLATE.md',
  'docs/feature-specs/0001-repo-governance.md',
  'docs/feature-specs/0002-lock-release-train.md',
  'docs/feature-specs/0002a-agent-genesis-packaging-readiness.md',
  'docs/feature-specs/0002b-editorial-ux-direction.md',
  'docs/testing/FEATURE-0.2-WINDOWS-WSL2-SMOKE.md',
  'docs/architecture/AGENT-GENESIS-AND-WORKSPACE-BOUNDARIES.md',
  'docs/ux/EDITORIAL-DESIGN-DIRECTION.md',
  'docs/brand/README.md',
  'docs/brand/assets/ai-for-boss-mark.svg',
  'docs/brand/assets/ai-for-boss-app-icon.svg',
  'docs/release/PRODUCT-READINESS-AUDIT-2026-08-11.md',
  'docs/licenses/inventory.json',
  'docs/licenses/sbom.baseline.cdx.json',
  'docs/licenses/THIRD_PARTY_NOTICES.md',
  'manifests/runtime/runtime-manifest.schema.json',
  'manifests/runtime/runtime-manifest.candidate.json',
  'manifests/runtime/openclaw-lab/package.json',
  'manifests/runtime/openclaw-lab/pnpm-workspace.yaml',
  'manifests/runtime/openclaw-lab/pnpm-lock.yaml',
  'docs/governance/AI-FOR-BOSS-BUILD-RULES.md',
  'docs/governance/AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md',
  'docs/governance/FINAL-AUDIT-2026-08-11.md',
  'docs/governance/GOVERNANCE-CHANGE-2026-08-11-AGENT-GENESIS.md',
  'docs/governance/GOVERNANCE-LOCK.json'
)

foreach ($relativePath in $requiredFiles) {
  $fullPath = Join-Path $repoRoot $relativePath
  if (-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) {
    Add-Failure "Missing required file: $relativePath"
  }
}

$lockPath = Join-Path $repoRoot 'docs/governance/GOVERNANCE-LOCK.json'
if (Test-Path -LiteralPath $lockPath -PathType Leaf) {
  try {
    $lock = Get-Content -LiteralPath $lockPath -Raw | ConvertFrom-Json
    foreach ($document in $lock.documents) {
      $documentPath = Join-Path $repoRoot $document.path
      if (-not (Test-Path -LiteralPath $documentPath -PathType Leaf)) {
        Add-Failure "Governance lock target missing: $($document.path)"
        continue
      }
      $actualHash = (Get-FileHash -LiteralPath $documentPath -Algorithm SHA256).Hash
      if ($actualHash -ne $document.sha256) {
        Add-Failure "Governance hash mismatch: $($document.path) expected $($document.sha256), got $actualHash"
      }
    }
  } catch {
    Add-Failure "Governance lock is invalid: $($_.Exception.Message)"
  }
}

$agentsPath = Join-Path $repoRoot 'AGENTS.md'
if (Test-Path -LiteralPath $agentsPath -PathType Leaf) {
  $agentsText = Get-Content -LiteralPath $agentsPath -Raw
  $requiredAgentTerms = @(
    'AI-FOR-BOSS-BUILD-RULES.md',
    'AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md',
    'DECISIONS.md',
    'RISKS.md',
    'active file under `docs/feature-specs/`'
  )
  foreach ($term in $requiredAgentTerms) {
    if (-not $agentsText.Contains($term)) {
      Add-Failure "AGENTS.md is missing required startup term: $term"
    }
  }
}

$forbiddenEnvFiles = Get-ChildItem -LiteralPath $repoRoot -Recurse -Force -File |
  Where-Object {
    $_.FullName -notmatch '[\\/]\.git[\\/]' -and
    $_.Name -match '^\.env(?:\..+)?$' -and
    $_.Name -ne '.env.example'
  }
foreach ($file in $forbiddenEnvFiles) {
  Add-Failure "Forbidden environment file present: $($file.FullName.Substring($repoRoot.Length + 1))"
}

$secretPatterns = @(
  [pscustomobject]@{ Name = 'OpenAI-style key'; Pattern = 'sk-[A-Za-z0-9_-]{20,}' },
  [pscustomobject]@{ Name = 'GitHub token'; Pattern = 'gh[pousr]_[A-Za-z0-9]{20,}' },
  [pscustomobject]@{ Name = 'Google API key'; Pattern = 'AIza[0-9A-Za-z_-]{30,}' },
  [pscustomobject]@{ Name = 'AWS access key'; Pattern = 'AKIA[0-9A-Z]{16}' },
  [pscustomobject]@{ Name = 'Private key'; Pattern = ('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----') }
)

$textExtensions = @('.md', '.txt', '.json', '.yml', '.yaml', '.ps1', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.html')
$candidateFiles = Get-ChildItem -LiteralPath $repoRoot -Recurse -Force -File |
  Where-Object {
    $_.FullName -notmatch '[\\/]\.git[\\/]' -and
    $textExtensions -contains $_.Extension.ToLowerInvariant()
  }

foreach ($file in $candidateFiles) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  foreach ($pattern in $secretPatterns) {
    if ($content -match $pattern.Pattern) {
      Add-Failure "Potential $($pattern.Name) found in $($file.FullName.Substring($repoRoot.Length + 1))"
    }
  }
}

$markdownFiles = $candidateFiles | Where-Object { $_.Extension -eq '.md' }
$relativeLinkPattern = '\[[^\]]+\]\((?!https?://|mailto:|#)(?<target>[^)#]+)(?:#[^)]*)?\)'
foreach ($file in $markdownFiles) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  if ($content.Contains([char]0xFFFD)) {
    Add-Failure "Unicode replacement character found in $($file.FullName.Substring($repoRoot.Length + 1))"
  }
  $fenceCount = ([regex]::Matches($content, '(?m)^```')).Count
  if ($fenceCount % 2 -ne 0) {
    Add-Failure "Unclosed Markdown fence in $($file.FullName.Substring($repoRoot.Length + 1))"
  }
  foreach ($match in [regex]::Matches($content, $relativeLinkPattern)) {
    $target = $match.Groups['target'].Value.Trim('<', '>')
    $resolvedTarget = Join-Path $file.DirectoryName $target
    if (-not (Test-Path -LiteralPath $resolvedTarget)) {
      Add-Failure "Broken local link in $($file.FullName.Substring($repoRoot.Length + 1)): $target"
    }
  }
}

if ($failures.Count -gt 0) {
  Write-Host 'Governance validation failed:' -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host " - $failure" -ForegroundColor Red
  }
  exit 1
}

Write-Host "Governance validation passed. Required files: $($requiredFiles.Count); scanned text files: $($candidateFiles.Count); Markdown files: $($markdownFiles.Count)." -ForegroundColor Green
