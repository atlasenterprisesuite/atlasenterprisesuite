drop policy if exists accounting_intercompany_matches_update on public.accounting_intercompany_matches;
create policy accounting_intercompany_matches_update on public.accounting_intercompany_matches
for update
using (
  public.can_write_accounting_data(org_id)
  or public.has_identity_permission(org_id,'accounting.post')
)
with check (
  public.can_write_accounting_data(org_id)
  or public.has_identity_permission(org_id,'accounting.post')
);

create or replace function public.guard_accounting_consolidation_group()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  parent_org uuid;
  exception_count integer;
  draft_adjustment_count integer;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(coalesce(new.org_id,old.org_id),'accounting.admin') then
    raise exception 'Accounting admin permission required';
  end if;

  if tg_op='DELETE' then
    if exists(select 1 from public.accounting_consolidation_members m where m.group_id=old.id)
       or exists(select 1 from public.accounting_intercompany_matches m where m.group_id=old.id)
       or exists(select 1 from public.accounting_consolidation_adjustments a where a.group_id=old.id) then
      raise exception 'Consolidation group with history cannot be deleted';
    end if;
    return old;
  end if;

  new.name := btrim(new.name);
  new.reporting_currency := upper(btrim(new.reporting_currency));
  if new.name='' then raise exception 'Consolidation group name is required'; end if;
  if new.reporting_currency !~ '^[A-Z]{3}$' then raise exception 'Reporting currency must use three letters'; end if;

  if new.parent_entity_id is not null then
    select org_id into parent_org from public.accounting_entities where id=new.parent_entity_id;
    if parent_org is null or parent_org<>new.org_id then raise exception 'Parent entity must belong to the organization'; end if;
  end if;

  if tg_op='INSERT' then
    new.status := 'active';
    new.created_by := auth.uid();
  else
    if old.status is distinct from new.status then
      if old.status='active' and new.status='locked' then
        select count(*) into exception_count from public.accounting_intercompany_matches where group_id=old.id and status='exception';
        select count(*) into draft_adjustment_count from public.accounting_consolidation_adjustments where group_id=old.id and status='draft';
        if exception_count>0 then raise exception 'Resolve intercompany exceptions before locking consolidation group'; end if;
        if draft_adjustment_count>0 then raise exception 'Post or remove draft consolidation adjustments before locking group'; end if;
      elsif old.status='locked' and new.status='archived' then
        null;
      else
        raise exception 'Unsupported consolidation group status transition';
      end if;
    end if;

    if old.status='locked' and new.status<>'archived' then
      raise exception 'Locked consolidation group is immutable except archive transition';
    end if;

    if old.reporting_currency is distinct from new.reporting_currency and (
      exists(select 1 from public.accounting_intercompany_matches m where m.group_id=old.id)
      or exists(select 1 from public.accounting_consolidation_adjustments a where a.group_id=old.id)
    ) then
      raise exception 'Reporting currency cannot change after consolidation activity exists';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.guard_accounting_consolidation_member()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  group_org uuid;
  group_status text;
  entity_org uuid;
  row_id uuid := case when tg_op='DELETE' then old.id else new.id end;
  target_group uuid := case when tg_op='DELETE' then old.group_id else new.group_id end;
  target_entity uuid := case when tg_op='DELETE' then old.entity_id else new.entity_id end;
  target_org uuid := case when tg_op='DELETE' then old.org_id else new.org_id end;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(target_org,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;

  select org_id,status into group_org,group_status from public.accounting_consolidation_groups where id=target_group;
  select org_id into entity_org from public.accounting_entities where id=target_entity;
  if group_org is null then raise exception 'Consolidation group not found'; end if;
  if group_org<>target_org or entity_org is null or entity_org<>target_org then raise exception 'Consolidation membership organization mismatch'; end if;
  if group_status<>'active' then raise exception 'Consolidation membership requires an active group'; end if;

  if tg_op='DELETE' then
    raise exception 'Consolidation membership is historical evidence; set effective_to instead of deleting';
  end if;

  if tg_op='UPDATE' then
    if row(new.org_id,new.group_id,new.entity_id,new.consolidation_method,new.ownership_pct,new.effective_from)
       is distinct from row(old.org_id,old.group_id,old.entity_id,old.consolidation_method,old.ownership_pct,old.effective_from) then
      raise exception 'Historical consolidation membership attributes are immutable; end the membership and create a new one';
    end if;
    if old.effective_to is not null then raise exception 'Ended consolidation membership is immutable'; end if;
    if new.effective_to is null or new.effective_to<greatest(new.effective_from,current_date) then
      raise exception 'Membership effective_to must be today or a future date';
    end if;
  end if;

  if new.effective_to is not null and new.effective_to<new.effective_from then raise exception 'Membership effective range is invalid'; end if;
  if exists(
    select 1 from public.accounting_consolidation_members m
    where m.group_id=new.group_id and m.entity_id=new.entity_id and m.id<>row_id
      and daterange(m.effective_from,coalesce(m.effective_to,'infinity'::date),'[]')
          && daterange(new.effective_from,coalesce(new.effective_to,'infinity'::date),'[]')
  ) then raise exception 'Consolidation membership periods cannot overlap'; end if;

  if tg_op='INSERT' then new.created_by:=auth.uid(); end if;
  new.updated_at:=now();
  return new;
end;
$$;

create or replace function public.guard_accounting_consolidation_adjustment()
returns trigger
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  group_org uuid;
  group_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  if tg_op='DELETE' then
    if old.status<>'draft' then raise exception 'Posted consolidation adjustment is immutable'; end if;
    if not public.has_identity_permission(old.org_id,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
    return old;
  end if;

  if not public.has_identity_permission(new.org_id,'accounting.post') then raise exception 'Accounting post permission required'; end if;
  select org_id,status into group_org,group_status from public.accounting_consolidation_groups where id=new.group_id;
  if group_org is null or group_org<>new.org_id then raise exception 'Consolidation group organization mismatch'; end if;

  new.reference:=btrim(new.reference);
  new.reason:=btrim(new.reason);
  if new.reference='' or new.reason='' then raise exception 'Adjustment reference and reason are required'; end if;

  if tg_op='INSERT' then
    if group_status<>'active' then raise exception 'Only an active consolidation group can receive adjustments'; end if;
    new.status:='draft';
    new.created_by:=auth.uid();
    new.posted_by:=null;
    new.posted_at:=null;
  elsif old.status in ('posted','locked') then
    if old.status='posted' and new.status='locked' and public.has_identity_permission(new.org_id,'accounting.admin') then
      new.updated_at:=now();
      return new;
    end if;
    raise exception 'Posted consolidation adjustment is immutable';
  else
    if group_status<>'active' then raise exception 'Only an active consolidation group can post adjustments'; end if;
    if new.status='posted' then
      if not public.validate_accounting_consolidation_adjustment(new.id) then raise exception 'Consolidation adjustment must be balanced before posting'; end if;
      new.posted_by:=auth.uid();
      new.posted_at:=now();
    elsif new.status<>'draft' then
      raise exception 'Unsupported consolidation adjustment transition';
    end if;
  end if;

  new.updated_at:=now();
  return new;
end;
$$;

create or replace function public.set_accounting_consolidation_group_status(
  organization_uuid uuid,
  group_uuid uuid,
  status_value text
) returns uuid
language plpgsql
set search_path to 'public','pg_temp'
as $$
declare
  current_org uuid;
  requested_status text := lower(btrim(status_value));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.has_identity_permission(organization_uuid,'accounting.admin') then raise exception 'Accounting admin permission required'; end if;
  if requested_status not in ('locked','archived') then raise exception 'Unsupported consolidation group status'; end if;

  select org_id into current_org from public.accounting_consolidation_groups where id=group_uuid for update;
  if current_org is null then raise exception 'Consolidation group not found'; end if;
  if current_org<>organization_uuid then raise exception 'Consolidation group organization mismatch'; end if;

  update public.accounting_consolidation_groups set status=requested_status where id=group_uuid and org_id=organization_uuid;
  return group_uuid;
end;
$$;
