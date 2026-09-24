# ATLAS CRM HubSpot developer project

This directory is the canonical HubSpot Developer Platform project definition for ATLAS CRM.

## Production contract

- Project: `atlas-crm-hubspot`
- App component UID: `atlas_crm_hubspot_app`
- Distribution: private
- Authentication: OAuth
- Redirect URL: `https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-crm-hubspot`
- Platform version: `2026.09`

The redirect URL must exactly match the URI returned by ATLAS CRM's `connection.configuration` operation and the `redirect_uri` sent on both the HubSpot authorize request and authorization-code exchange.

## Deploying from Windows

From the project directory, use the HubSpot CLI command shim because PowerShell execution policies may block `hs.ps1`:

```powershell
hs.cmd project upload
if ($LASTEXITCODE -eq 0) { hs.cmd project deploy }
```

After deployment, open the project:

```powershell
hs.cmd project open
```

In HubSpot, open **Project components → ATLAS CRM HubSpot → Authentication** and verify the registered redirect URL matches the production contract above. For private distribution, also verify the target HubSpot account is approved under **Distribution**.

Do not store OAuth Client Secret values in this repository.
