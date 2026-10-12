import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createWebLaunchBlueprintState } from '../../packages/creator/web_launch';
import {
  buildBrandExperiencePack,
  renderBrandExperienceText,
  validateBrandDestination
} from '../../packages/creator/brand_experience';

const profile = {
  ...createWebLaunchBlueprintState().profile,
  brand: 'North Star',
  audience: 'commuters',
  promise: 'comfort on each trip',
  primaryAction: 'Explore collection',
  language: 'English'
};

describe('ATLAS Brand Experience — truthful local drafting', () => {
  it('fails closed if required context is missing', () => {
    const outcome = buildBrandExperiencePack(createWebLaunchBlueprintState().profile, {
      productName: '', founderStory: '', destinationUrl: ''
    });
    expect(outcome.pack).toBeNull();
    expect(outcome.errors).toContain('brand');
    expect(outcome.errors).toContain('product');
    expect(outcome.errors).toContain('audience');
    expect(outcome.errors).toContain('promise');
  });

  it('does not fabricate founder stories, impact claims or testimonials', () => {
    const result = buildBrandExperiencePack(profile, {
      productName: 'Cloud Runner', founderStory: '', destinationUrl: ''
    });
    expect(result.pack?.story).toContain('No founder story was supplied');
    expect(result.pack?.socialCaption).toContain('comfort on each trip');
    expect(result.pack?.socialCaption).not.toMatch(/donat|500,000|verified|testimonial/i);
    expect(result.warnings.join(' ')).toMatch(/evidence/i);
  });

  it('labels supplied proof for review rather than certifying it', () => {
    const result = buildBrandExperiencePack({ ...profile, proof: '9 out of 10 customers like it' }, {
      productName: 'Cloud Runner', founderStory: 'Made by a small team.', destinationUrl: 'https://store.example.com/shoes'
    });
    expect(result.pack?.proofReview).toMatch(/not independently verified/i);
    expect(result.pack?.story).toContain('Made by a small team.');
    expect(result.pack?.destination).toBe('https://store.example.com/shoes');
  });

  it('blocks unsafe destinations and never outputs unsafe links', () => {
    for (const address of ['javascript:alert(1)', 'http://example.com', 'https://localhost/', 'https://127.0.0.1/', 'https://alice:password@example.com/']) {
      expect(validateBrandDestination(address)).toBeNull();
      const result = buildBrandExperiencePack(profile, { productName: 'Cloud Runner', founderStory: '', destinationUrl: address });
      expect(result.pack?.destination).toBeNull();
      expect(result.warnings.join(' ')).toMatch(/link/i);
    }
  });

  it('supports Spanish copy and explicit draft export', () => {
    const result = buildBrandExperiencePack({ ...profile, language: 'Spanish' }, {
      productName: 'Cloud Runner', founderStory: '', destinationUrl: 'https://store.example.com'
    });
    expect(result.pack?.packagingNote).toMatch(/Gracias/);
    expect(result.pack?.socialCaption).toContain('Para commuters');
    expect(renderBrandExperienceText(result.pack!)).toContain('BORRADOR');
    expect(renderBrandExperienceText(result.pack!)).toContain('https://store.example.com/');
  });

  it('registers a studio-accessible panel without creating another module registry route', () => {
    const webLaunch = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/web/WebLaunchPage.tsx'), 'utf8');
    const studio = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/experience/CreatorExperiencePage.tsx'), 'utf8');
    expect(webLaunch).toContain('<BrandExperiencePanel profile={blueprint.profile} />');
    expect(studio).toContain('/studio/web-launch#brand-experience');
    expect(webLaunch).toContain('BrandExperiencePanel');
  });
});
