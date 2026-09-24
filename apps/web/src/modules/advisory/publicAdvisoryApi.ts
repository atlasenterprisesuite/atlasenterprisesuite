const PUBLIC_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLIC_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type BusinessLaunch360Intake = {
  fullName: string;
  businessName?: string;
  email: string;
  phone?: string;
  website?: string;
  businessStage?: string;
  goals?: string;
  companyFax?: string;
};

export async function submitBusinessLaunch360Intake(input: BusinessLaunch360Intake) {
  const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/atlas-advisory-public`, {
    method: 'POST',
    headers: {
      apikey: PUBLIC_SUPABASE_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify(input)
  });
  const text = await response.text();
  let payload: { ok?: boolean; reference?: string; error?: string } = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok || !payload.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return { reference: String(payload.reference || '') };
}
