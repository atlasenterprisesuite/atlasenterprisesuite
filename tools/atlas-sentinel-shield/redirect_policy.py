"""Validate supplied synthetic/observed hops offline; never resolve or connect."""
from ipaddress import ip_address, ip_network
from link_inspector import inspect_link

_V6_PUBLIC = ip_network('2000::/3')
_V6_DENY = tuple(ip_network(x) for x in ('2001::/23', '2002::/16', '2001:db8::/32', '3fff::/20'))
_V4_DENY = tuple(ip_network(x) for x in ('192.0.0.0/24', '192.88.99.0/24'))


def _public_address(value):
    if not isinstance(value, str) or len(value) > 45 or '%' in value:
        return False
    try:
        addr = ip_address(value)
    except ValueError:
        return False
    if not addr.is_global or addr.is_multicast or addr.is_reserved or addr.is_loopback or addr.is_link_local or addr.is_unspecified:
        return False
    if addr.version == 6:
        return addr in _V6_PUBLIC and not any(addr in net for net in _V6_DENY)
    return not any(addr in net for net in _V4_DENY)


def inspect_observed_chain(chain):
    """At most six observations (initial URL plus five redirects); no trust grant."""
    def result(reason, hops=0):
        return {'decision': 'NO_GO', 'reason': reason, 'hops': hops}

    if not isinstance(chain, (list, tuple)) or not 1 <= len(chain) <= 6:
        return result('CHAIN_REJECTED')
    seen = set()
    for hop in chain:
        if not isinstance(hop, (list, tuple)) or len(hop) != 2:
            return result('HOP_REJECTED')
        url, addresses = hop
        if inspect_link(url)['reason'] != 'UNVERIFIED' or url in seen:
            return result('HOP_REJECTED')
        seen.add(url)
        if not isinstance(addresses, (list, tuple)) or not 1 <= len(addresses) <= 16 or not all(_public_address(a) for a in addresses):
            return result('ADDRESS_REJECTED')
    return result('OBSERVATIONS_ONLY', len(chain))
