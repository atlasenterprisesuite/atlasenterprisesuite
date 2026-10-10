-- ATLAS Finance temporary import staging hardening.
-- Browser clients intentionally have no direct access. Server/service-role workflows remain available.

alter table public._atlas_fin_import_20260915 enable row level security;

revoke all privileges on table public._atlas_fin_import_20260915 from anon;
revoke all privileges on table public._atlas_fin_import_20260915 from authenticated;

comment on table public._atlas_fin_import_20260915 is
  'ATLAS Finance temporary import staging. Server/service-role only; browser roles are intentionally denied and no client RLS policies are defined.';
