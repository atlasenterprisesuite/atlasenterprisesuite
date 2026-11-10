create or replace function public.redact_atlas_audit_jsonb(input_value jsonb)
returns jsonb
language plpgsql
immutable
strict
security invoker
set search_path to 'public', 'pg_temp'
as $function$
declare
  result_value jsonb;
  item_key text;
  item_value jsonb;
begin
  case jsonb_typeof(input_value)
    when 'object' then
      result_value := '{}'::jsonb;
      for item_key, item_value in select key, value from jsonb_each(input_value)
      loop
        if lower(item_key) ~ '(^|[_-])(password|passwd|passcode|secret|token|credential|authorization|cookie|session_key|api_key|apikey|client_secret|private_key|mfa_secret|otp_secret|access_token|refresh_token)([_-]|$)' then
          result_value := result_value || jsonb_build_object(item_key, '[REDACTED]');
        else
          result_value := result_value || jsonb_build_object(item_key, public.redact_atlas_audit_jsonb(item_value));
        end if;
      end loop;
      return result_value;
    when 'array' then
      select coalesce(jsonb_agg(public.redact_atlas_audit_jsonb(value)), '[]'::jsonb)
        into result_value
      from jsonb_array_elements(input_value);
      return result_value;
    else
      return input_value;
  end case;
end;
$function$;

revoke all on function public.redact_atlas_audit_jsonb(jsonb) from public, anon, authenticated;
grant execute on function public.redact_atlas_audit_jsonb(jsonb) to postgres, service_role;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  organization_uuid uuid;
  entity_id text;
  old_snapshot jsonb;
  new_snapshot jsonb;
begin
  organization_uuid := case when tg_op = 'DELETE' then old.org_id else new.org_id end;
  entity_id := case when tg_op = 'DELETE' then old.id::text else new.id::text end;

  old_snapshot := case
    when tg_op in ('UPDATE','DELETE') then public.redact_atlas_audit_jsonb(to_jsonb(old))
    else null
  end;

  new_snapshot := case
    when tg_op in ('INSERT','UPDATE') then public.redact_atlas_audit_jsonb(to_jsonb(new))
    else null
  end;

  insert into public.audit_logs(org_id, user_id, action, table_name, record_id, old_data, new_data)
  values(
    organization_uuid,
    auth.uid(),
    lower(tg_table_name || '.' || tg_op),
    tg_table_name,
    entity_id,
    old_snapshot,
    new_snapshot
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;
