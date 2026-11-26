/** Informational envelope only; not authentication, provenance or authorization. */
export function contextDataMessage(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  return {role:'user',content:JSON.stringify({kind:'atlas_context_data',authority:'none',text:text.slice(0,12000)})};
}
