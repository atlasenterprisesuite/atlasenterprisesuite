import { describe, it, expect } from 'vitest';
import { evaluateUinConnectorRequest as gate } from './uin-connector-gate.mjs';
const valid = { tenantId:'tenant', actorId:'actor', authorized:true, providerVerified:true, credentialsConfigured:true, connectionState:'connected', operation:'read', requiredCapabilities:['documents.read'], grantedCapabilities:['documents.read'] };
describe('UIN connector gate (fail closed)', () => {
 it('allows authorized verified read', () => expect(gate(valid).allowed).toBe(true));
 it('blocks missing tenant scope', () => expect(gate({...valid,tenantId:null}).allowed).toBe(false));
 it('blocks unverified provider', () => expect(gate({...valid,providerVerified:false}).allowed).toBe(false));
 it('blocks missing capability', () => expect(gate({...valid,grantedCapabilities:[]}).allowed).toBe(false));
 it('blocks mutation without approval', () => expect(gate({...valid,operation:'write'}).allowed).toBe(false));
 it('blocks paid execution without approval', () => expect(gate({...valid,estimatedCost:1}).allowed).toBe(false));
 it('blocks malformed requests', () => expect(gate(null).allowed).toBe(false));
});
