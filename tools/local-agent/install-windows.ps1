param(
  [string]$InstallRoot = "$env:ProgramData\ATLAS\LocalAgent"
)

$ErrorActionPreference = "Stop"
$node = (Get-Command node -ErrorAction Stop).Source
$major = [int]((& $node -p "Number(process.versions.node.split('.')[0])").Trim())
if ($major -lt 22) { throw "Node.js 22+ is required." }
$openssl = (Get-Command openssl -ErrorAction Stop).Source

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $InstallRoot "runtime"
$config = Join-Path $InstallRoot "config"
$state = Join-Path $InstallRoot "state"
New-Item -ItemType Directory -Force -Path $runtime,(Join-Path $runtime "lib"),$config,$state | Out-Null

Copy-Item (Join-Path $source "atlas-local-agent.mjs") (Join-Path $runtime "atlas-local-agent.mjs") -Force
Copy-Item (Join-Path $source "lib\realtime-client.mjs") (Join-Path $runtime "lib\realtime-client.mjs") -Force
Copy-Item (Join-Path $source "lib\secure-state.mjs") (Join-Path $runtime "lib\secure-state.mjs") -Force

$key = Join-Path $config "agent.key"
$csr = Join-Path $config "agent.csr"
$cert = Join-Path $config "agent.crt"
$enrollment = Join-Path $config "enrollment.code"
$devices = Join-Path $config "devices.json"

if (-not (Test-Path $key)) {
  & $openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out $key
  if ($LASTEXITCODE -ne 0) { throw "OpenSSL private-key generation failed." }
}
$cn = ($env:COMPUTERNAME -replace '[^A-Za-z0-9._-]','')
& $openssl req -new -key $key -out $csr -subj "/O=ATLAS Enterprise Suite/OU=Local Agent/CN=$cn"
if ($LASTEXITCODE -ne 0) { throw "OpenSSL CSR generation failed." }

$code = $env:ATLAS_AGENT_ENROLLMENT_CODE
if ([string]::IsNullOrWhiteSpace($code)) {
  $secure = Read-Host "ATLAS one-time enrollment code" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $code = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
[IO.File]::WriteAllText($enrollment, $code, [Text.UTF8Encoding]::new($false))
Remove-Item Env:ATLAS_AGENT_ENROLLMENT_CODE -ErrorAction SilentlyContinue
if (-not (Test-Path $devices)) { [IO.File]::WriteAllText($devices, "[]" + [Environment]::NewLine, [Text.UTF8Encoding]::new($false)) }

# Restrict private state/config to SYSTEM and Administrators.
foreach ($target in @($key,$enrollment,$devices,$state)) {
  & icacls $target /inheritance:r /grant:r "SYSTEM:(OI)(CI)F" "Administrators:(OI)(CI)F" | Out-Null
}

$envFile = Join-Path $config "run-agent.ps1"
$wrapper = @(
  "`$env:ATLAS_AGENT_STATE_FILE = '$state\state.json'",
  "`$env:ATLAS_AGENT_ENROLLMENT_CODE_FILE = '$enrollment'",
  "`$env:ATLAS_LOCAL_DEVICES_FILE = '$devices'",
  "`$env:ATLAS_AGENT_MTLS_CERT_FILE = '$cert'",
  "`$env:ATLAS_AGENT_MTLS_KEY_FILE = '$key'",
  "`$env:ATLAS_LOCAL_CONTROL_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control'",
  "`$env:ATLAS_AGENT_REALTIME_URL = 'wss://www.atlasenterprisesuite.com/_atlas/local-bus/connect'",
  "& '$node' '$runtime\atlas-local-agent.mjs'"
) -join [Environment]::NewLine
[IO.File]::WriteAllText($envFile, $wrapper + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
& icacls $envFile /inheritance:r /grant:r "SYSTEM:F" "Administrators:F" | Out-Null

$taskName = "ATLAS Local Agent"
$argument = "-NoProfile -NonInteractive -ExecutionPolicy RemoteSigned -File `"$envFile`""
$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument $argument
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -RestartCount 20 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName

Write-Host "CSR: $csr"
Write-Host "Save the issued public certificate as $cert and bind fingerprint/serial/expiry in ATLAS Device OS."
