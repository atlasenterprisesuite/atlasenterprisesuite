# ATLAS 777 — read-only encrypted Supabase genome export, PowerShell 7.
# No changes to the hosted project. Do not upload resulting archives to public GitHub.
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^age1[0-9a-z]+$')][string]$AgeRecipient,
  [string]$ProjectRef = 'ggmanzcgtlrvqfoccgsh',
  [string]$OutputDirectory = (Join-Path $HOME 'ATLAS-Private-Backups'),
  [switch]$SchemaOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
foreach ($tool in @('supabase','age','tar')) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "Missing required tool: $tool" }
}
$helpText = (& supabase functions download --help 2>&1 | Out-String)
if ($LASTEXITCODE -ne 0 -or $helpText -notmatch '--remote') { throw 'Supabase CLI --remote is required.' }
$repoRoot = Split-Path $PSScriptRoot -Parent
$manifestPath = Join-Path $repoRoot 'docs/atlas-supabase/genome-live-20261113.json'
if (-not (Test-Path $manifestPath)) { throw "Missing genome manifest: $manifestPath" }
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
if ($manifest.edge_function_count -ne 100 -or @($manifest.edge_functions).Count -ne 100) { throw 'P0: manifest is incomplete.' }
$slugs = @($manifest.edge_functions | ForEach-Object { $_.slug })
$runId = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$work = Join-Path $env:TEMP "atlas-genome-$runId"
$out = Join-Path $OutputDirectory "ATLAS-Supabase-Genome-$runId.tar.gz.age"
New-Item -ItemType Directory -Path $work,$OutputDirectory -Force | Out-Null
$cwd = (Get-Location).Path
$complete = $false
try {
  Set-Location $work
  & supabase init --yes | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Local CLI initialization failed.' }
  & supabase config pull "--remote=$ProjectRef" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Config pull failed.' }
  & supabase migration fetch "--remote=$ProjectRef" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Migration history pull failed.' }
  foreach ($slug in $slugs) {
    & supabase functions download $slug "--remote=$ProjectRef" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Function download failed: $slug" }
    $dir = Join-Path $work "supabase/functions/$slug"
    if (-not (Test-Path $dir) -or @(Get-ChildItem $dir -Recurse -File).Count -eq 0) {
      throw "No source files for: $slug"
    }
  }
  New-Item -ItemType Directory -Path 'database' -Force | Out-Null
  & supabase db dump "--remote=$ProjectRef" -f 'database/roles.sql' --role-only | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Roles dump failed.' }
  & supabase db dump "--remote=$ProjectRef" -f 'database/schema.sql' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Schema dump failed.' }
  if (-not $SchemaOnly) {
    & supabase db dump "--remote=$ProjectRef" -f 'database/data.sql' --data-only --use-copy -x 'storage.buckets_vectors' -x 'storage.vector_indexes' | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Data dump failed.' }
  }
  foreach ($path in @('database/roles.sql','database/schema.sql')) {
    if (-not (Test-Path $path) -or (Get-Item $path).Length -eq 0) { throw "P0: empty export $path" }
  }
  if (-not $SchemaOnly -and ((-not (Test-Path 'database/data.sql')) -or (Get-Item 'database/data.sql').Length -eq 0)) {
    throw 'P0: missing data export.'
  }
  Copy-Item $manifestPath 'genome-live.json'
  $status = [ordered]@{
    source_project = $ProjectRef
    timestamp_utc = (Get-Date).ToUniversalTime().ToString('o')
    functions_downloaded = 100
    database_data_included = (-not $SchemaOnly)
    storage_object_bytes_included = $false
    auth_provider_settings_included = $false
    environment_secrets_included = $false
  }
  $status | ConvertTo-Json | Set-Content 'GENOME_STATUS.json' -Encoding utf8
  $checks = @(Get-ChildItem $work -Recurse -File | Where-Object { $_.Name -ne 'SHA256SUMS.json' } | ForEach-Object {
    [pscustomobject]@{
      path = [IO.Path]::GetRelativePath($work,$_.FullName).Replace('\','/')
      sha256 = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    }
  })
  $checks | ConvertTo-Json -Depth 4 | Set-Content 'SHA256SUMS.json' -Encoding utf8
  $tarPath = Join-Path $env:TEMP "atlas-genome-$runId.tar.gz"
  try {
    & tar -czf $tarPath -C $work .
    if ($LASTEXITCODE -ne 0) { throw 'Archive creation failed.' }
    & age -r $AgeRecipient -o $out $tarPath
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $out) -or (Get-Item $out).Length -lt 100) { throw 'Archive encryption failed.' }
    $complete = $true
    Write-Output "Encrypted export: $out"
    Write-Output 'Restore is NOT certified until Storage bytes, Auth configuration, secrets and E2E are verified.'
  } finally {
    if (Test-Path $tarPath) { Remove-Item $tarPath -Force }
  }
} finally {
  Set-Location $cwd
  if (Test-Path $work) { Remove-Item $work -Recurse -Force }
  if (-not $complete -and (Test-Path $out)) { Remove-Item $out -Force }
}
