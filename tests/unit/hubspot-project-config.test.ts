import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { HUBSPOT_P0_SCOPES } from '../../supabase/functions/_shared/hubspot-connection-lifecycle';

const projectRoot = resolve(process.cwd(), 'hubspot/atlas-crm-hubspot');
const project = JSON.parse(readFileSync(resolve(projectRoot, 'hsproject.json'), 'utf8')) as {
  name: string;
  srcDir: string;
  platformVersion: string;
};
const app = JSON.parse(readFileSync(resolve(projectRoot, 'src/app/app-hsmeta.json'), 'utf8')) as {
  uid: string;
  type: string;
  config: {
    distribution: string;
    auth: {
      type: string;
      redirectUrls: string[];
      requiredScopes: string[];
      optionalScopes: string[];
      conditionallyRequiredScopes: string[];
    };
  };
};

describe('HubSpot developer project contract', () => {
  it('preserves the original generated HubSpot app component identity', () => {
    expect(project).toMatchObject({
      name: 'atlas-crm-hubspot',
      srcDir: 'src',
      platformVersion: '2026.09'
    });
    expect(app.uid).toBe('atlas_crm_hubspot_app');
    expect(app.type).toBe('app');
    expect(app.config.distribution).toBe('private');
  });

  it('keeps HubSpot OAuth aligned with the ATLAS production callback', () => {
    expect(app.config.auth.type).toBe('oauth');
    expect(app.config.auth.redirectUrls).toEqual([
      'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-crm-hubspot'
    ]);
    expect(app.config.auth.requiredScopes).toEqual([...HUBSPOT_P0_SCOPES]);
    expect(app.config.auth.optionalScopes).toEqual([]);
    expect(app.config.auth.conditionallyRequiredScopes).toEqual([]);
  });
});
