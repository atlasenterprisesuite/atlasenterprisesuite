do $$
declare def text;
begin
  select pg_get_functiondef('public.atlas_run_release_e2e()'::regprocedure) into def;
  if position('min(id)' in def)=0 then raise exception 'expected_min_uuid_expression_not_found'; end if;
  def:=replace(def,'min(id)','min(id::text)::uuid');
  execute def;
end$$;
