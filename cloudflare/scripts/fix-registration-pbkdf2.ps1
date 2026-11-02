# ProcureFlow: fix Cloudflare Workers PBKDF2 >100000 iteration error.
# Preserves all other Worker code (login, documents, notifications, finance, approvals).
# Run inside the cloudflare/ directory:
#   powershell -ExecutionPolicy Bypass -File ./scripts/fix-registration-pbkdf2.ps1

param(
    [string]$WorkerPath = (Join-Path $PSScriptRoot '..\src\index.ts')
)

$ErrorActionPreference = 'Stop'
$target = [System.IO.Path]::GetFullPath($WorkerPath)
if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    throw "Worker file not found: $target"
}

$source = [System.IO.File]::ReadAllText($target)
$oldPattern = '(?m)^(\s*const\s+PASSWORD_ITERATIONS\s*=\s*)210_?000(\s*;)'
$newPattern = '(?m)^\s*const\s+PASSWORD_ITERATIONS\s*=\s*100_?000\s*;'
$matches = [System.Text.RegularExpressions.Regex]::Matches($source, $oldPattern)

if ($matches.Count -eq 0) {
    if ([System.Text.RegularExpressions.Regex]::IsMatch($source, $newPattern)) {
        Write-Host 'Already fixed: PASSWORD_ITERATIONS = 100_000. No files changed.' -ForegroundColor Green
        exit 0
    }
    throw 'Could not find PASSWORD_ITERATIONS = 210_000. Check the current value in cloudflare/src/index.ts; no files changed.'
}
if ($matches.Count -ne 1) {
    throw "Found $($matches.Count) matching assignments. Expected exactly one; no files changed."
}

$backup = "$target.backup-before-pbkdf2-fix-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
[System.IO.File]::Copy($target, $backup, $false)
$fixed = [System.Text.RegularExpressions.Regex]::Replace(
    $source,
    $oldPattern,
    '${1}100_000${2}'
)
[System.IO.File]::WriteAllText($target, $fixed, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Fixed PBKDF2 iteration count in $target" -ForegroundColor Green
Write-Host "Backup: $backup"
Write-Host 'Next: npx wrangler deploy'
