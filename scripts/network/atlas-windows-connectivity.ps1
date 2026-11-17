# ATLAS 777 REVIEW — Windows read-only connectivity diagnostics
# Run locally on a Windows computer you own or are authorized to administer.
# Emits only a small sanitized JSON summary; no passwords, IP addresses, SSIDs,
# WireGuard keys, interface identifiers or traffic captures. Never uploads data.
[CmdletBinding()]
param()

$upCount = 0
$wgPresent = $false
$wgUp = $false
$dnsResolved = $false
$tcp443Reachable = $false

try {
  $adapters = @(Get-NetAdapter -ErrorAction Stop)
  $upCount = @($adapters | Where-Object { $_.Status -eq 'Up' }).Count
  $wg = @($adapters | Where-Object {
    $_.Name -match 'WireGuard' -or $_.InterfaceDescription -match 'WireGuard'
  })
  $wgPresent = $wg.Count -gt 0
  $wgUp = @($wg | Where-Object { $_.Status -eq 'Up' }).Count -gt 0
} catch {
  # Unknown adapter state is reported via zero/false only; no sensitive detail.
}

try {
  $dnsResolved = @(
    Resolve-DnsName -Name 'example.com' -Type A -ErrorAction Stop |
      Where-Object { $_.Type -eq 'A' }
  ).Count -gt 0
} catch {}

try {
  $tcp443Reachable = [bool](Test-NetConnection -ComputerName '1.1.1.1' -Port 443 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction Stop)
} catch {}

[pscustomobject]@{
  schema = 'atlas-network-diagnostics-v1'
  source = 'user-run-windows-powershell'
  measuredAt = (Get-Date).ToUniversalTime().ToString('o')
  adaptersUpCount = $upCount
  dnsResolved = [bool]$dnsResolved
  tcp443Reachable = [bool]$tcp443Reachable
  wireGuardAdapterPresent = [bool]$wgPresent
  wireGuardAdapterUp = [bool]$wgUp
} | ConvertTo-Json -Compress

# DNS query and public TCP 443 check verify specific reachability only.
# A WireGuard adapter being up does NOT establish a successful VPN handshake.
