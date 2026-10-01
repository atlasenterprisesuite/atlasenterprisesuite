param(
  [string]$InstallRoot = "$env:LOCALAPPDATA\ATLAS\RemoteAgent"
)

$ErrorActionPreference = "Stop"
$node = (Get-Command node -ErrorAction Stop).Source
$major = [int]((& $node -p "Number(process.versions.node.split('.')[0])").Trim())
if ($major -lt 22) { throw "Node.js 22+ is required." }
$openssl = (Get-Command openssl -ErrorAction Stop).Source

$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $InstallRoot "runtime"
$lib = Join-Path $runtime "lib"
$config = Join-Path $InstallRoot "config"
$state = Join-Path $InstallRoot "state"
New-Item -ItemType Directory -Force -Path $runtime,$lib,$config,$state | Out-Null

Copy-Item (Join-Path $source "atlas-local-agent.mjs") (Join-Path $runtime "atlas-local-agent.mjs") -Force
Copy-Item (Join-Path $source "lib\*.mjs") $lib -Force

$key = Join-Path $config "agent.key"
$csr = Join-Path $config "agent.csr"
$cert = Join-Path $config "agent.crt"
$enrollment = Join-Path $config "enrollment.code"
$devices = Join-Path $config "devices.json"

if (-not (Test-Path $key)) {
  & $openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out $key
  if ($LASTEXITCODE -ne 0) { throw "OpenSSL private-key generation failed." }
}

$cn = (($env:COMPUTERNAME + "-remote") -replace '[^A-Za-z0-9._-]','')
& $openssl req -new -key $key -out $csr -subj "/O=ATLAS Enterprise Suite/OU=Remote Desktop/CN=$cn"
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
if (-not (Test-Path $devices)) {
  [IO.File]::WriteAllText($devices, "[]" + [Environment]::NewLine, [Text.UTF8Encoding]::new($false))
}

Write-Host ""
Write-Host "ATLAS Remote runs visibly in this signed-in Windows session."
Write-Host "Each remote session requires an on-screen consent prompt."
Write-Host "Press Ctrl+C in this window to stop remote access."
Write-Host "CSR: $csr"
Write-Host ""

$env:ATLAS_AGENT_STATE_FILE = "$state\state.json"
$env:ATLAS_AGENT_ENROLLMENT_CODE_FILE = $enrollment
$env:ATLAS_LOCAL_DEVICES_FILE = $devices
$env:ATLAS_AGENT_MTLS_CERT_FILE = $cert
$env:ATLAS_AGENT_MTLS_KEY_FILE = $key
$env:ATLAS_LOCAL_CONTROL_URL = "https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control"
$env:ATLAS_AGENT_REALTIME_URL = "wss://www.atlasenterprisesuite.com/_atlas/local-bus/connect"
$env:ATLAS_REMOTE_DESKTOP_ENABLED = "true"
$env:ATLAS_AGENT_FALLBACK_POLL_MS = "1500"

& $node (Join-Path $runtime "atlas-local-agent.mjs")
