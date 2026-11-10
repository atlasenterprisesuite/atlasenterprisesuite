-- Harden payroll execution settlement so both INSERT and UPDATE paths require provider evidence.

create or replace function public.payroll_guard_execution_settlement()
returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $$
begin
  if new.state = 'settled'
     and (tg_op = 'INSERT' or coalesce(old.state,'') <> 'settled')
     and not exists (
       select 1
       from public.payroll_execution_evidence e
       where e.org_id = new.org_id
         and e.intent_id = new.id
         and e.normalized_state = 'settled'
         and nullif(btrim(e.payload_hash),'') is not null
     ) then
    raise exception 'settled_evidence_required';
  end if;

  return new;
end;
$$;

drop trigger if exists payroll_execution_intent_settlement_guard on public.payroll_execution_intents;
create trigger payroll_execution_intent_settlement_guard
before insert or update on public.payroll_execution_intents
for each row execute function public.payroll_guard_execution_settlement();
