"""Offline triage of supplied reports, not a trusted threat feed or safety verdict."""
from link_inspector import inspect_link

def assess_reputation(url, reports):
    def result(reason):
        return {'decision': 'NO_GO', 'reason': reason}
    inspected = inspect_link(url)
    if inspected['reason'] != 'UNVERIFIED':
        return result('INVALID_INPUT')
    if not isinstance(reports, (list, tuple)) or len(reports) > 256:
        return result('INVALID_INPUT')
    adverse = False
    for record in reports:
        if not isinstance(record, (list, tuple)) or len(record) != 2:
            return result('INVALID_INPUT')
        host, status = record
        if not isinstance(host, str) or len(host) > 253 or status not in ('malicious', 'suspicious', 'safe', 'unknown'):
            return result('INVALID_INPUT')
        parsed = inspect_link('https://' + host)
        if parsed['reason'] != 'UNVERIFIED' or parsed['host'] != host:
            return result('INVALID_INPUT')
        if host == inspected['host'] and status in ('malicious', 'suspicious'):
            adverse = True
    return result('ADVERSE_REPORT' if adverse else 'UNKNOWN')
