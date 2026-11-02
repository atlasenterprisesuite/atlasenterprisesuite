# ATLAS Network Doctor — diagnostic truth gate
Read-only Python 3.9+ diagnostics. Run `python tools/network-doctor/network_doctor.py`.
Run tests with `python -m unittest discover -s tools/network-doctor -v`.
`verified_internet` requires actual HTTPS/TLS success, not just DNS or TCP.
`unverified_environment_or_network` is **not** proof that the user's carrier is down.
No automatic OS/network changes; operator-side faults need authorized carrier access.
Production release requires CI, deployment and E2E evidence. This package is not a deployed user-device repair agent.
