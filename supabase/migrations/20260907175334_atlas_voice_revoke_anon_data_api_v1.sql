-- Defense in depth: ATLAS Voice is authenticated-only at both table privileges and RLS.
revoke all privileges on table public.atlas_voice_profiles from anon;
revoke all privileges on table public.atlas_voice_permission_grants from anon;
revoke all privileges on table public.atlas_voice_transcripts from anon;
revoke all privileges on table public.atlas_voice_recording_sessions from anon;
revoke all privileges on table public.atlas_voice_samples from anon;
revoke all privileges on table public.atlas_voice_consents from anon;
revoke all privileges on table public.atlas_voice_generation_jobs from anon;
revoke all privileges on table public.atlas_voice_audit_events from anon;
