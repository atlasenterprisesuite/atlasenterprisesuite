"""Offline reference policy; callers must supply independently verified server metadata."""

SOURCES = ('document', 'retrieval', 'tool_result')
DECISIONS = ('DATA_ONLY', 'DENY_TENANT', 'DENY_PROVENANCE', 'DENY_SOURCE', 'DENY_UNKNOWN')


def evaluate_context(*, actor_tenant, record_tenant, source, verified):
    """Never grants instruction or execution authority; no content is inspected."""
    if (type(actor_tenant) is not str or type(record_tenant) is not str
            or not actor_tenant.strip() or actor_tenant != actor_tenant.strip()
            or actor_tenant != record_tenant):
        return 'DENY_TENANT'
    if verified is not True:
        return 'DENY_PROVENANCE'
    if type(source) is not str or source not in SOURCES:
        return 'DENY_SOURCE'
    return 'DATA_ONLY'


def audit_decision(decision):
    """Emit only fixed codes, never document contents or tenant identifiers."""
    if type(decision) is not str or decision not in DECISIONS:
        decision = 'DENY_UNKNOWN'
    return {'control': 'context_guard', 'decision': decision}
