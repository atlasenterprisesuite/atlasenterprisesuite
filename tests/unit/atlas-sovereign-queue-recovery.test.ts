import { describe, it, expect } from 'vitest';
import { planAtlasDeployQueue, type AtlasDeployRequest } from '../../packages/core/src/deploymentControl';
const active: AtlasDeployRequest = { id: 'active', project: 'atlas', sourceSha: 'a'.repeat(40), environment: 'preview', provider: 'cloudflare', requestedAt: 1 };
describe('sovereign queue recovery', () => {
  it('coalesces an active identical build but preserves different environments', () => {
    const result = planAtlasDeployQueue({ requests: [{...active,id:'duplicate'}, {...active,id:'staging',environment:'staging'}], inFlight:[active], now:10, policy:{maxConcurrent:3,minProviderIntervalMs:0,coalesceSameSource:true} });
    expect(result.coalesced.map(x=>x.id)).toEqual(['duplicate']);
    expect(result.launch.map(x=>x.id)).toEqual(['staging']);
  });
});
