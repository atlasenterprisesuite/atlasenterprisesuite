# ATLAS Local Core portable user-scoped installer. No admin elevation or network access.
param(
  [string]$InstallRoot = (Join-Path $env:LOCALAPPDATA 'ATLAS\LocalCore')
)
$ErrorActionPreference = 'Stop'
if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is required.' }
$node = (Get-Command node -ErrorAction Stop).Source
$major = [int]((& $node -p "Number(process.versions.node.split('.')[0])").Trim())
if ($major -lt 22) { throw 'Node.js 22+ is required.' }
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$runtime = Join-Path $InstallRoot 'runtime'
$runtimeLib = Join-Path $runtime 'lib'
$private = Join-Path $InstallRoot 'private'
foreach ($folder in @($InstallRoot, $runtime, $runtimeLib, $private)) {
  if ((Test-Path -LiteralPath $folder) -and ((Get-Item -LiteralPath $folder -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
    throw "Unsafe junction/symlink path: $folder"
  }
}
New-Item -ItemType Directory -Force -Path $InstallRoot, $runtime, $runtimeLib, $private | Out-Null
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
foreach ($folder in @($InstallRoot, $runtime, $runtimeLib, $private)) {
  & icacls.exe $folder /inheritance:r /grant:r "*${sid}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Failed to secure ACL: $folder" }
}
foreach ($name in @('atlas-local-core-device.mjs', 'atlas-local-core.mjs', 'atlas-local-ai-runtime.mjs')) {
  Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $runtime $name) -Force
}
foreach ($name in @('local-core-vault.mjs', 'local-core-client.mjs')) {
  Copy-Item -LiteralPath (Join-Path $source "lib\$name") -Destination (Join-Path $runtimeLib $name) -Force
}
$launcher = Join-Path $InstallRoot 'atlas-local-core.cmd'
$command = '@echo off' + [Environment]::NewLine + 'node "%~dp0runtime\atlas-local-core-device.mjs" %*' + [Environment]::NewLine + 'exit /b %ERRORLEVEL%' + [Environment]::NewLine
[IO.File]::WriteAllText($launcher, $command, [Text.UTF8Encoding]::new($false))
& $node --check (Join-Path $runtime 'atlas-local-core-device.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Local Core script failed syntax validation.' }
& $node --check (Join-Path $runtimeLib 'local-core-vault.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Vault script failed syntax validation.' }
& $launcher doctor
if ($LASTEXITCODE -ne 0) { throw 'Local Core doctor failed.' }
Write-Host "Installed portable Local Core to: $InstallRoot"
Write-Host ('Run: & "' + $launcher + '" help')
Write-Host 'No model download, remote enrollment or autostart has been enabled.'
