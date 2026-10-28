// ATLAS Teleprompter 777: build-time, fail-closed preview isolation gate.
// This check validates deployment configuration only; it does not make any
// network call or claim that a staging backend is provisioned or healthy.
const env = process.env;
const preview = env.VERCEL_ENV === 'preview' || env.ATLAS_TELEPROMPTER_STAGING === 'true';

if (preview) {
  const ref = String(env.VITE_ATLAS_STAGING_PROJECT_REF || '').trim();
  const url = String(env.VITE_SUPABASE_URL || '').trim();
  const key = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
  const productionRef = 'ggmanzcgtlrvqfoccgsh';

  // Supabase project refs are 20 lowercase letters. The frontend must target
  // that exact project, not a production fallback, localhost, HTTP, or proxy.
  const validRef = /^[a-z]{20}$/.test(ref) && ref !== productionRef;
  const validUrl = validRef && url === `https://${ref}.supabase.co`;
  const validKey = key.length > 0;
  if (!validRef || !validUrl || !validKey) {
    process.stderr.write(
      'teleprompter_staging_isolation_required: preview deployment needs an explicit non-production Supabase project URL, matching VITE_ATLAS_STAGING_PROJECT_REF and publishable key. Never reuse ATLAS production credentials.\n'
    );
    process.exit(1);
  }
  process.stdout.write('teleprompter_preview_backend_isolated_by_project_ref\n');
}
