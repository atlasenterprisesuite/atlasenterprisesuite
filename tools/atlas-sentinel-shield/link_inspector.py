"""Offline URL preflight only. Never performs DNS, HTTP or a safety certification."""
import re
from urllib.parse import urlsplit

_LABEL = re.compile(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\Z', re.ASCII)
_TLD = re.compile(r'[a-z]{2,63}\Z', re.ASCII)
_RESERVED = {'localhost', 'local', 'internal', 'home', 'lan', 'onion', 'test', 'invalid', 'example', 'arpa'}


def inspect_link(raw):
    denied = {'decision': 'NO_GO', 'reason': 'REJECTED', 'host': None}
    if not isinstance(raw, str) or not 0 < len(raw) <= 4096:
        return denied
    if any(ord(c) < 33 or ord(c) > 126 or c == '\\' for c in raw):
        return denied
    if not raw.startswith('https://'):
        return denied
    try:
        parts = urlsplit(raw)
        host = parts.netloc.lower()
    except ValueError:
        return denied
    labels = host.split('.')
    if (len(host) > 253 or len(labels) < 2 or not _TLD.fullmatch(labels[-1])
            or labels[-1] in _RESERVED
            or any(not _LABEL.fullmatch(x) or x.startswith('xn--') for x in labels)):
        return denied
    return {'decision': 'NO_GO', 'reason': 'UNVERIFIED', 'host': host}
