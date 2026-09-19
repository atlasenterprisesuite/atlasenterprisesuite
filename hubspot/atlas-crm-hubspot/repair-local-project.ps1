$ErrorActionPreference = "Stop"

$project = Join-Path $HOME "Documents\atlas-crm-hubspot"
$appFile = Join-Path $project "src\app\app-hsmeta.json"
$projectFile = Join-Path $project "hsproject.json"
$webhookDir = Join-Path $project "src\app\webhooks"
$webhookFile = Join-Path $webhookDir "atlas-crm-hubspot-webhooks-hsmeta.json"

if (-not (Test-Path $project)) { throw "HubSpot project not found at $project" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "Node.js is not available in PATH" }
if (-not (Get-Command hs.cmd -ErrorAction SilentlyContinue)) { throw "HubSpot CLI (hs.cmd) is not available in PATH" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
foreach ($file in @($appFile, $projectFile, $webhookFile)) {
  if (Test-Path $file) { Copy-Item $file "$file.$stamp.bak" -Force }
}
New-Item -ItemType Directory -Path $webhookDir -Force | Out-Null

$canonicalRepo = if ($env:ATLAS_CANONICAL_REPO) { $env:ATLAS_CANONICAL_REPO.Trim() } else { "atlasenterprisesuite/atlasenterprisesuite" }
if ($canonicalRepo -notmatch "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$") { throw "Invalid ATLAS_CANONICAL_REPO" }
$rawRoot = "https://raw.githubusercontent.com/$canonicalRepo/main/hubspot/atlas-crm-hubspot"
$downloads = @(
  @("$rawRoot/src/app/app-hsmeta.json", $appFile),
  @("$rawRoot/hsproject.json", $projectFile),
  @("$rawRoot/src/app/webhooks/atlas-crm-hubspot-webhooks-hsmeta.json", $webhookFile)
)

foreach ($item in $downloads) {
  curl.exe -f -L $item[0] -o $item[1]
  if ($LASTEXITCODE -ne 0) { throw "Failed to download canonical ATLAS HubSpot project file" }
}

Push-Location $project
try {
  node -e "const fs=require('fs');const a=JSON.parse(fs.readFileSync('src/app/app-hsmeta.json','utf8'));const p=JSON.parse(fs.readFileSync('hsproject.json','utf8'));const w=JSON.parse(fs.readFileSync('src/app/webhooks/atlas-crm-hubspot-webhooks-hsmeta.json','utf8'));if(a.uid!=='atlas_crm_hubspot_app')throw new Error('UID mismatch');if(!a.config.auth.requiredScopes.includes('crm.objects.tickets.read'))throw new Error('ticket scope missing');if(a.config.auth.requiredScopes.includes('tickets'))throw new Error('legacy tickets scope present');if(p.platformVersion!=='2026.09')throw new Error('platform version mismatch');if(w.type!=='webhooks'||w.config.settings.targetUrl!=='https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-crm-hubspot')throw new Error('webhook config mismatch');console.log('ATLAS_HUBSPOT_PROJECT_OK');"
  if ($LASTEXITCODE -ne 0) { throw "HubSpot project validation failed" }

  hs.cmd project upload
  if ($LASTEXITCODE -ne 0) { throw "HubSpot project upload/deploy failed" }

  Write-Host "ATLAS_HUBSPOT_PROJECT_DEPLOY_OK"
}
finally {
  Pop-Location
}
