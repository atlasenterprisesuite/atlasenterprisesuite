REVOKE ALL ON FUNCTION public.atlas_bootstrap_owner(text,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.atlas_bootstrap_owner(text,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.atlas_bootstrap_owner(text,text) TO authenticated;
