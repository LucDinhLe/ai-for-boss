$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$failures = [System.Collections.Generic.List[string]]::new()
$ignoredDirectoryNames = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($directoryName in @('.git', 'node_modules', 'dist', 'out')) {
  [void]$ignoredDirectoryNames.Add($directoryName)
}

function Add-Failure([string]$message) {
  $failures.Add($message)
}

function Get-RepositoryFiles([string]$root) {
  $pendingDirectories = [System.Collections.Generic.Stack[string]]::new()
  $pendingDirectories.Push($root)

  while ($pendingDirectories.Count -gt 0) {
    $currentDirectory = $pendingDirectories.Pop()
    try {
      $entries = Get-ChildItem -LiteralPath $currentDirectory -Force -ErrorAction Stop
    }
    catch {
      Add-Failure "Unable to enumerate repository path: $currentDirectory"
      continue
    }

    foreach ($entry in $entries) {
      if ($entry.PSIsContainer) {
        if (-not $ignoredDirectoryNames.Contains($entry.Name)) {
          $pendingDirectories.Push($entry.FullName)
        }
        continue
      }
      $entry
    }
  }
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
  'docs/feature-specs/0002c-competitive-parity-three-step-headless.md',
  'docs/testing/FEATURE-0.2-WINDOWS-WSL2-SMOKE.md',
  'docs/architecture/AGENT-GENESIS-AND-WORKSPACE-BOUNDARIES.md',
  'docs/ux/EDITORIAL-DESIGN-DIRECTION.md',
  'docs/brand/README.md',
  'docs/brand/assets/ai-for-boss-mark.svg',
  'docs/brand/assets/ai-for-boss-app-icon.svg',
  'docs/release/PRODUCT-READINESS-AUDIT-2026-08-11.md',
  'docs/release/COMPETITIVE-PARITY-AND-HEADLESS-AUDIT-2026-08-11.md',
  'docs/licenses/inventory.json',
  'docs/licenses/sbom.baseline.cdx.json',
  'docs/licenses/THIRD_PARTY_NOTICES.md',
  'manifests/runtime/runtime-manifest.schema.json',
  'manifests/runtime/runtime-manifest.lock.json',
  'manifests/runtime/openclaw-lab/package.json',
  'manifests/runtime/openclaw-lab/pnpm-workspace.yaml',
  'manifests/runtime/openclaw-lab/pnpm-lock.yaml',
  'docs/governance/AI-FOR-BOSS-BUILD-RULES.md',
  'docs/governance/AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md',
  'docs/governance/FINAL-AUDIT-2026-08-11.md',
  'docs/governance/GOVERNANCE-CHANGE-2026-08-11-AGENT-GENESIS.md',
  'docs/governance/GOVERNANCE-CHANGE-2026-08-11-PARITY-HEADLESS.md',
  'docs/governance/GOVERNANCE-CHANGE-2026-08-11-GATEWAY-CONTRACT.md',
  'docs/governance/GOVERNANCE-CHANGE-2026-08-11-FIRST-RUN.md',
  'docs/governance/GOVERNANCE-LOCK.json',
  'manifests/runtime/gateway-contract.schema.json',
  'manifests/runtime/gateway-contract.lock.json',
  'tests/contract/release-train-contract.test.mjs',
  'artifacts/feature-0.2/lab/gateway-contract-smoke.json',
  'docs/feature-specs/0003-capability-threat-model.md',
  'docs/architecture/CAPABILITY-INVENTORY.md',
  'docs/architecture/SOURCE-OF-TRUTH-AND-DATA-FLOW.md',
  'docs/security/THREAT-MODEL.md',
  'docs/security/PROVIDER-AUTH-MATRIX.md',
  'docs/release/FEATURE-0.3-AUDIT.md',
  'manifests/capabilities/capability-manifest.schema.json',
  'manifests/capabilities/openclaw-2026.7.1-2.capability-manifest.json',
  'manifests/providers/auth-support.schema.json',
  'manifests/providers/auth-support.manifest.json',
  'manifests/data/source-of-truth.schema.json',
  'manifests/data/source-of-truth.manifest.json',
  'manifests/agents/agent-genesis.schema.json',
  'manifests/agents/agent-genesis.contract.json',
  'manifests/security/threat-model.schema.json',
  'manifests/security/threat-model.manifest.json',
  'scripts/validate-feature-0.3.mjs',
  'tests/contract/capability-threat-model-contract.test.mjs',
  'tests/contract/governance-status-contract.test.mjs',
  'docs/feature-specs/0004-app-shell-cross-platform-ci.md',
  'docs/feature-specs/0005-first-run-journey.md',
  'docs/release/FEATURE-0.4-AUDIT.md',
  'docs/release/FEATURE-0.5-AUDIT.md',
  'docs/feature-specs/0006-sandbox-feasibility.md',
  'docs/architecture/SANDBOX-FEASIBILITY-ADR.md',
  'docs/release/FEATURE-0.6-AUDIT.md',
  'manifests/security/sandbox-feasibility.manifest.json',
  'manifests/security/sandbox-feasibility.schema.json',
  'manifests/security/sandbox-feasibility-probe.schema.json',
  'src/sandbox/feasibility-policy.mjs',
  'src/sandbox/feasibility-probe.mjs',
  'scripts/spike/sandbox-feasibility-probe.mjs',
  'scripts/validate-feature-0.6.mjs',
  'tests/contract/sandbox-feasibility-contract.test.mjs',
  'PROGRESS.md',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
  'eslint.config.mjs',
  '.github/workflows/desktop-shell.yml',
  'apps/desktop/package.json',
  'apps/desktop/index.html',
  'apps/desktop/tsconfig.json',
  'apps/desktop/vite.config.ts',
  'apps/desktop/electron/main.mjs',
  'apps/desktop/electron/preload.cjs',
  'apps/desktop/electron/security-policy.mjs',
  'apps/desktop/electron/shell-contract.mjs',
  'apps/desktop/src/App.tsx',
  'apps/desktop/src/first-run-machine.mjs',
  'apps/desktop/src/first-run-machine.d.ts',
  'apps/desktop/src/global.d.ts',
  'apps/desktop/src/main.tsx',
  'apps/desktop/src/styles.css',
  'scripts/generate-desktop-contract.mjs',
  'scripts/package-desktop.mjs',
  'scripts/validate-feature-0.4.mjs',
  'scripts/validate-feature-0.5.mjs',
  'scripts/generate-feature-0.5-qa.mjs',
  'tests/contract/desktop-shell-security-contract.test.mjs',
  'tests/contract/first-run-security-contract.test.mjs',
  'tests/unit/first-run-machine.test.mjs',
  'tests/unit/desktop-contract.test.mjs',
  'artifacts/feature-0.5/README.md'
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

$masterPlanPath = Join-Path $repoRoot 'docs/governance/AI-FOR-BOSS-MASTER-EXECUTION-PLAN.md'
if (Test-Path -LiteralPath $masterPlanPath -PathType Leaf) {
  $masterPlanText = Get-Content -LiteralPath $masterPlanPath -Raw
  $requiredMasterPlanTerms = @(
    'release train `oc-2026.7.1-2-locked.1`',
    '| Phiên bản OpenClaw stable được khóa | Feature 0.2 | Đã khóa trong release train `oc-2026.7.1-2-locked.1`:',
    '**Trạng thái:** Hoàn thành ở mức hợp đồng và kiểm tra cục bộ.'
  )
  foreach ($term in $requiredMasterPlanTerms) {
    if (-not $masterPlanText.Contains($term)) {
      Add-Failure "Master Plan is missing current release/feature status: $term"
    }
  }
  if ($masterPlanText.Contains('| Phiên bản OpenClaw stable được khóa | Feature 0.2 | Chưa khóa |')) {
    Add-Failure 'Master Plan still marks the locked Feature 0.2 release train as unresolved'
  }
}

$readinessAuditPath = Join-Path $repoRoot 'docs/release/PRODUCT-READINESS-AUDIT-2026-08-11.md'
if (Test-Path -LiteralPath $readinessAuditPath -PathType Leaf) {
  $readinessAuditText = Get-Content -LiteralPath $readinessAuditPath -Raw
  if (-not $readinessAuditText.Contains('Feature 0.3 đã hoàn thành ở mức contract.')) {
    Add-Failure 'Product readiness audit does not record Feature 0.3 contract completion'
  }
  if ($readinessAuditText.Contains('Hoàn thành Feature 0.3 đến 0.6')) {
    Add-Failure 'Product readiness audit still lists completed Feature 0.3 as pending'
  }
}

$feature06AuditPath = Join-Path $repoRoot 'docs/release/FEATURE-0.6-AUDIT.md'
if (Test-Path -LiteralPath $feature06AuditPath -PathType Leaf) {
  $feature06AuditText = Get-Content -LiteralPath $feature06AuditPath -Raw
  foreach ($term in @('spike-tested', 'documented-primary-source', 'assumption-pending', 'blocked-or-not-feasible', 'không chứng minh isolation')) {
    if (-not $feature06AuditText.Contains($term)) {
      Add-Failure "Feature 0.6 audit is missing evidence/boundary term: $term"
    }
  }
}

$repositoryFiles = @(Get-RepositoryFiles $repoRoot)

$forbiddenEnvFiles = $repositoryFiles |
  Where-Object {
    $_.Name -match '^\.env(?:\..+)?$' -and
    $_.Name -ne '.env.example'
  }
foreach ($file in $forbiddenEnvFiles) {
  Add-Failure "Forbidden environment file present: $($file.FullName.Substring($repoRoot.Length + 1))"
}

$secretPatterns = @(
  [pscustomobject]@{ Name = 'OpenAI-style key'; Pattern = '(?<![A-Za-z0-9_])sk-[A-Za-z0-9_-]{20,}' },
  [pscustomobject]@{ Name = 'GitHub token'; Pattern = 'gh[pousr]_[A-Za-z0-9]{20,}' },
  [pscustomobject]@{ Name = 'Google API key'; Pattern = 'AIza[0-9A-Za-z_-]{30,}' },
  [pscustomobject]@{ Name = 'AWS access key'; Pattern = 'AKIA[0-9A-Z]{16}' },
  [pscustomobject]@{ Name = 'Private key'; Pattern = ('-----BEGIN ' + '(?:RSA |EC |OPENSSH )?PRIVATE KEY-----') }
)

$textExtensions = @('.md', '.txt', '.json', '.yml', '.yaml', '.ps1', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.html')
$candidateFiles = $repositoryFiles |
  Where-Object {
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
