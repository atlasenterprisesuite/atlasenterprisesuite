# OpenAI connectivity guidance in ATLAS Computer Operations

The existing `/work/computer-operations` center now offers symptom-specific guidance for streaming, uploads, voice, TLS and iOS failures. It reuses the existing route probes and production contract. The source is the OpenAI network recommendations article supplied by the owner:
https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps

The guidance is deliberately marked guidance-only in its model. It does not declare external provider readiness or infer DNS, TLS, firewall, WebSocket or UDP availability from a generic fetch failure. No cross-origin probes, new provider, secrets, permissions or firewall mutations are introduced. Official status and help links are available from the existing center.

Existing same-origin probes now abort after 10 seconds by default, clear timers after settlement, and report `browser_probe_timeout` as unavailable. Critical route and production exact-SHA gates retain their existing authority.

Validation covers symptom selection, published transport requirements, HTTP errors and stalled probes. Production completion requires canonical PR checks, merge, Cloudflare delivery and exact-revision verification.
