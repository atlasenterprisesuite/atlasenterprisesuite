"""ATLAS Network Doctor: safe, read-only connectivity truth gate (Python 3.9+)."""
import json
import socket
import ssl
import time
import urllib.request
import urllib.error

def dns_probe(host):
    try:
        addresses = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
        return {"ok": bool(addresses), "addresses": sorted({a[4][0] for a in addresses})[:5]}
    except OSError as exc:
        return {"ok": False, "error": type(exc).__name__}

def tcp_probe(host, port=443, timeout=3):
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return {"ok": True}
    except OSError as exc:
        return {"ok": False, "error": type(exc).__name__}

def https_probe(url="https://www.example.com/", timeout=5):
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "ATLAS-Network-Doctor/0.2"})
        with urllib.request.urlopen(request, timeout=timeout, context=ssl.create_default_context()) as response:
            return {"ok": 200 <= response.status < 400, "http_status": response.status}
    except (OSError, urllib.error.URLError, ValueError) as exc:
        return {"ok": False, "error": type(exc).__name__}

def diagnose():
    dns = dns_probe("www.example.com")
    direct = tcp_probe("1.1.1.1")
    https = https_probe() if dns["ok"] else {"ok": False, "reason": "dns_failed"}
    if https["ok"]:
        status = "verified_internet"
    elif direct["ok"] and not dns["ok"]:
        status = "dns_failure_suspected"
    elif not direct["ok"] and not dns["ok"]:
        status = "unverified_environment_or_network"
    else:
        status = "partial_or_blocked"
    return {"status": status, "verified": status == "verified_internet",
            "dns": dns, "direct_ip_tcp443": direct, "https_tls": https,
            "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "scope": "execution_host_only",
            "warning": "Never infer a user's device status from server diagnostics. No network settings modified."}

if __name__ == "__main__":
    print(json.dumps(diagnose(), indent=2))
