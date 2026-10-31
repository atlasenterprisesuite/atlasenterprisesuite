/** Read-only ChatGPT app catalog. No tool execution or credential handling. */
export const ATLAS_CHATGPT_APPS = [
  ['core','ATLAS Core','server'],['intelligence','ATLAS Intelligence','brain-circuit'],
  ['business','ATLAS Business','briefcase-business'],['accounting','ATLAS Accounting','calculator'],
  ['tax','ATLAS Tax','receipt-text'],['pay','ATLAS Pay','credit-card'],
  ['commerce','ATLAS Commerce','shopping-cart'],['operations','ATLAS Operations','boxes'],
  ['people','ATLAS People','users'],['payroll','ATLAS Payroll','wallet'],
  ['connect','ATLAS Connect','messages-square'],['telecom','ATLAS Telecom','radio-tower'],
  ['device-os','ATLAS Device OS','smartphone'],['galaxy','ATLAS Galaxy','orbit'],
  ['automations','ATLAS Automations','workflow'],['security','ATLAS Security','shield-check'],
  ['studio','ATLAS Studio','clapperboard'],['voice','ATLAS Voice','mic'],
  ['learning','ATLAS Learning','graduation-cap'],['ride','ATLAS Ride','car-front'],
  ['gps-5d','ATLAS GPS 5D','map-pinned'],['aviation','ATLAS Aviation','plane'],
  ['digital-city','ATLAS Digital City','building-2'],['research','ATLAS Research','microscope'],
  ['insurance','ATLAS Insurance','shield'],['hospitality','ATLAS Hospitality','hotel'],
  ['entertainment','ATLAS Entertainment','music'],['bible-os','ATLAS Bible OS','book-open'],
  ['manager','ATLAS Manager','layout-dashboard'],
] as const;

export type AtlasChatGptApp = { id: string; name: string; icon: string; status: 'not_connected' };
export function listAtlasChatGptApps(): AtlasChatGptApp[] {
  return ATLAS_CHATGPT_APPS.map(([id,name,icon]) => ({ id,name,icon,status:'not_connected' }));
}
export function listAtlasChatGptReadOnlyTools() {
  return [
    { name:'atlas.apps.catalog', description:'List conceptual ATLAS apps without claiming installation.', annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false,idempotentHint:true} },
  ] as const;
}
