"""ATLAS Network Doctor advanced read-only telemetry. No privileged operations."""
import datetime
import json
import socket
import statistics
import time
from collections import defaultdict

def sample_tcp(host="1.1.1.1", port=443, count=5, timeout=2, connector=None):
    """TCP handshake success ratio is a proxy, NOT ICMP packet loss."""
    connector = connector or socket.create_connection
    samples = []
    for _ in range(count):
        start = time.monotonic()
        try:
            with connector((host, port), timeout=timeout):
                samples.append(round((time.monotonic()-start)*1000, 2))
        except OSError:
            samples.append(None)
    successes = [x for x in samples if x is not None]
    return {"status": "measured" if count > 0 else "unavailable",
            "tcp_failure_percent": round(100*(count-len(successes))/count, 2) if count else None,
            "tcp_latency_ms": successes,
            "jitter_proxy_ms": round(statistics.mean(abs(b-a) for a,b in zip(successes,successes[1:])),2) if len(successes)>1 else None,
            "packet_loss_percent": None,
            "note": "TCP failures are not ICMP packet loss; proxy/VPN/server may affect results."}

def device_capabilities(platform="unknown", provider=None):
    """Never fabricate iOS radio, roaming, VPN or power state."""
    values = {"signal_dbm": None, "roaming": None, "low_power_mode": None, "vpn_active": None}
    if provider:
        for key in values:
            try:
                values[key] = provider(key)
            except (OSError, PermissionError, NotImplementedError, KeyError):
                pass
    return {"platform": platform, "values": values,
            "availability": {k: "measured" if v is not None else "unavailable" for k,v in values.items()},
            "note": "iOS apps cannot assume access to private radio or system VPN/power APIs."}

def hourly_outages(events, min_samples=3):
    """events: UTC ISO timestamp + bool 'ok'. Only show trends with enough samples."""
    groups = defaultdict(list)
    for event in events:
        stamp = datetime.datetime.fromisoformat(event["timestamp"].replace("Z","+00:00"))
        groups[stamp.astimezone(datetime.timezone.utc).hour].append(bool(event["ok"]))
    return {f"{hour:02d}:00 UTC": {"samples":len(vals),
        "failure_rate_percent":round(100*(1-sum(vals)/len(vals)),2) if len(vals)>=min_samples else None,
        "status":"measured" if len(vals)>=min_samples else "insufficient_data"}
        for hour,vals in sorted(groups.items())}

if __name__ == "__main__":
    print(json.dumps({"connectivity":sample_tcp(),"device":device_capabilities(),
                      "hourly_patterns":hourly_outages([])}, indent=2))
