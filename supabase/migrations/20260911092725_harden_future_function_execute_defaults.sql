-- Prevent future functions in public from inheriting executable access.
-- Explicit grants must be reviewed per function after creation.
alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from authenticated;

-- Cloudflare credential and verifier helpers remain service-side only.
revoke execute on function public.atlas_cloudflare_access_credentials_present() from public, anon, authenticated;
revoke execute on function public.atlas_get_cloudflare_control_credentials() from public, anon, authenticated;
revoke execute on function public.atlas_store_cloudflare_access_credentials(text,text,text) from public, anon, authenticated;
revoke execute on function public.atlas_store_cloudflare_control_credentials(text,text,text) from public, anon, authenticated;
revoke execute on function public.atlas_run_public_infra_verification() from public, anon, authenticated;

grant execute on function public.atlas_cloudflare_access_credentials_present() to service_role;
grant execute on function public.atlas_get_cloudflare_control_credentials() to service_role;
grant execute on function public.atlas_store_cloudflare_access_credentials(text,text,text) to service_role;
grant execute on function public.atlas_store_cloudflare_control_credentials(text,text,text) to service_role;
grant execute on function public.atlas_run_public_infra_verification() to service_role;
