$ErrorActionPreference = "Stop"

$project = Join-Path $HOME "Documents\atlas-crm-hubspot"
$appFile = Join-Path $project "src\app\app-hsmeta.json"
$projectFile = Join-Path $project "hsproject.json"

if (-not (Test-Path $appFile)) { throw "HubSpot app config not found at $appFile" }
if (-not (Test-Path $projectFile)) { throw "HubSpot project config not found at $projectFile" }

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
Copy-Item $appFile "$appFile.$stamp.bak" -Force
Copy-Item $projectFile "$projectFile.$stamp.bak" -Force

$appJson = @'
{
  "uid": "atlas_crm_hubspot_app",
  "type": "app",
  "config": {
    "description": "ATLAS Enterprise Suite CRM integration for governed HubSpot OAuth connectivity and read-only CRM access.",
    "name": "ATLAS CRM HubSpot",
    "distribution": "private",
    "auth": {
      "type": "oauth",
      "redirectUrls": [
        "https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-crm-hubspot"
      ],
      "requiredScopes": [
        "oauth",
        "crm.objects.contacts.read",
        "crm.objects.companies.read",
        "crm.objects.deals.read",
        "crm.objects.tickets.read"
      ],
      "optionalScopes": [],
      "conditionallyRequiredScopes": []
    },
    "permittedUrls": {
      "fetch": ["https://api.hubapi.com"],
      "iframe": [],
      "img": []
    }
  }
}
'@

$projectJson = @'
{
  "name": "atlas-crm-hubspot",
  "srcDir": "src",
  "platformVersion": "2026.09"
}
'@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($appFile, $appJson, $utf8NoBom)
[System.IO.File]::WriteAllText($projectFile, $projectJson, $utf8NoBom)

Push-Location $project
try {
  node -e "JSON.parse(require('fs').readFileSync('src/app/app-hsmeta.json','utf8')); JSON.parse(require('fs').readFileSync('hsproject.json','utf8')); console.log('ATLAS_HUBSPOT_JSON_OK')"
  if ($LASTEXITCODE -ne 0) { throw "JSON validation failed" }

  hs.cmd project upload
  if ($LASTEXITCODE -ne 0) { throw "HubSpot project upload failed" }

  hs.cmd project deploy
  if ($LASTEXITCODE -ne 0) { throw "HubSpot project deploy failed" }

  Write-Host "ATLAS_HUBSPOT_DEPLOY_OK"
}
finally {
  Pop-Location
}
