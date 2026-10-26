import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

describe('Astronomy 777 route security contract',()=>{
 const router=readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx','utf8');
 const page=readFileSync('apps/web/src/modules/astronomy/AstronomyObservatoryPage.tsx','utf8');
 it('requires ATLAS identity before mounting astronomy',()=>{
   expect(router).toContain("pathname === '/knowledge/astronomy'");
   expect(router).toMatch(/pathname === '\/knowledge\/astronomy'[\s\S]*?<RequireAtlasIdentity><AstronomyObservatoryPage \/><\/RequireAtlasIdentity>/);
 });
 it('does not persist or upload originals without backend authorization',()=>{
   expect(page).not.toMatch(/\.upload\(|\.insert\(|fetch\(/);
   expect(page).toContain("crypto.subtle.digest('SHA-256'");
   expect(page).toContain('verifyImageBytes');
 });
 it('disables unverified confirmed scientific labels',()=>{
   expect(page).toContain('value="confirmed" disabled');
 });
});
