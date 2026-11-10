-- ATLAS FRONTIER Awakening campaign progression.
alter table public.frontier_runs
  add column if not exists campaign_stage smallint not null default 1 check (campaign_stage between 1 and 5),
  add column if not exists experience integer not null default 0 check (experience >= 0);

update public.frontier_runs
set campaign_stage = greatest(campaign_stage,
  case
    when sky_grid_integrity >= 25 then 5
    when power_cores >= 1 then 4
    when habitats >= 1 then 3
    when aetherium >= 4 and alloy >= 3 and biofiber >= 3 then 2
    else 1
  end
);

create or replace function public.frontier_apply_action(p_org_id uuid,p_action text,p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_user_id uuid:=auth.uid();
  v_run public.frontier_runs%rowtype;
  v_existing public.frontier_events%rowtype;
  v_before jsonb;
  v_after jsonb;
  v_event_id uuid;
  v_xp integer:=0;
begin
  if v_user_id is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if p_org_id is null or not (public.has_identity_permission(p_org_id,'frontier.play') or public.has_identity_permission(p_org_id,'frontier.manage')) then
    raise exception 'frontier_permission_denied' using errcode='42501';
  end if;
  if p_idempotency_key is null or char_length(btrim(p_idempotency_key))<8 then raise exception 'frontier_invalid_idempotency_key' using errcode='22023'; end if;

  select * into v_existing from public.frontier_events
  where org_id=p_org_id and actor_user_id=v_user_id and idempotency_key=p_idempotency_key;
  if found then return jsonb_build_object('ok',true,'idempotent',true,'revision',v_existing.resulting_revision,'state',v_existing.resulting_state,'event_id',v_existing.id); end if;

  insert into public.frontier_runs(tenant_id,org_id,actor_user_id) values(p_org_id,p_org_id,v_user_id)
  on conflict(org_id,actor_user_id) do nothing;
  select * into v_run from public.frontier_runs where org_id=p_org_id and actor_user_id=v_user_id for update;
  if not found then raise exception 'frontier_run_unavailable'; end if;

  v_before:=jsonb_build_object('aetherium',v_run.aetherium,'alloy',v_run.alloy,'biofiber',v_run.biofiber,'powerCores',v_run.power_cores,'habitats',v_run.habitats,'skyGridIntegrity',v_run.sky_grid_integrity,'actionCount',v_run.action_count,'stormMinutes',v_run.storm_minutes,'campaignStage',v_run.campaign_stage,'experience',v_run.experience);

  case p_action
    when 'extract_aetherium' then v_run.aetherium:=v_run.aetherium+4; v_xp:=10;
    when 'salvage_alloy' then v_run.alloy:=v_run.alloy+3; v_xp:=10;
    when 'harvest_biofiber' then v_run.biofiber:=v_run.biofiber+3; v_xp:=10;
    when 'build_habitat' then
      if v_run.campaign_stage<2 then raise exception 'frontier_campaign_gate_habitat' using errcode='P0001'; end if;
      if v_run.alloy<12 or v_run.biofiber<8 then raise exception 'frontier_insufficient_resources_habitat' using errcode='P0001'; end if;
      v_run.alloy:=v_run.alloy-12; v_run.biofiber:=v_run.biofiber-8; v_run.habitats:=v_run.habitats+1; v_xp:=80;
    when 'craft_power_core' then
      if v_run.campaign_stage<3 then raise exception 'frontier_campaign_gate_power_core' using errcode='P0001'; end if;
      if v_run.aetherium<20 or v_run.alloy<10 or v_run.biofiber<4 then raise exception 'frontier_insufficient_resources_power_core' using errcode='P0001'; end if;
      v_run.aetherium:=v_run.aetherium-20; v_run.alloy:=v_run.alloy-10; v_run.biofiber:=v_run.biofiber-4; v_run.power_cores:=v_run.power_cores+1; v_xp:=60;
    when 'restore_sky_grid' then
      if v_run.campaign_stage<4 then raise exception 'frontier_campaign_gate_sky_grid' using errcode='P0001'; end if;
      if v_run.sky_grid_integrity>=100 then raise exception 'frontier_sky_grid_already_stable' using errcode='P0001'; end if;
      if v_run.power_cores<1 or v_run.aetherium<8 then raise exception 'frontier_insufficient_resources_sky_grid' using errcode='P0001'; end if;
      v_run.power_cores:=v_run.power_cores-1; v_run.aetherium:=v_run.aetherium-8; v_run.sky_grid_integrity:=least(100,v_run.sky_grid_integrity+25); v_xp:=120;
    else raise exception 'frontier_unknown_action' using errcode='22023';
  end case;

  if v_run.campaign_stage=1 and v_run.aetherium>=4 and v_run.alloy>=3 and v_run.biofiber>=3 then v_run.campaign_stage:=2; end if;
  if v_run.campaign_stage=2 and v_run.habitats>=1 then v_run.campaign_stage:=3; end if;
  if v_run.campaign_stage=3 and v_run.power_cores>=1 then v_run.campaign_stage:=4; end if;
  if v_run.campaign_stage=4 and v_run.sky_grid_integrity>=25 then v_run.campaign_stage:=5; end if;

  v_run.experience:=v_run.experience+v_xp;
  v_run.action_count:=v_run.action_count+1;
  v_run.storm_minutes:=greatest(0,v_run.storm_minutes-1);
  v_run.revision:=v_run.revision+1;
  v_run.updated_at:=now();

  update public.frontier_runs set
    aetherium=v_run.aetherium,alloy=v_run.alloy,biofiber=v_run.biofiber,power_cores=v_run.power_cores,habitats=v_run.habitats,
    sky_grid_integrity=v_run.sky_grid_integrity,action_count=v_run.action_count,storm_minutes=v_run.storm_minutes,
    campaign_stage=v_run.campaign_stage,experience=v_run.experience,revision=v_run.revision,updated_at=v_run.updated_at
  where id=v_run.id;

  v_after:=jsonb_build_object('aetherium',v_run.aetherium,'alloy',v_run.alloy,'biofiber',v_run.biofiber,'powerCores',v_run.power_cores,'habitats',v_run.habitats,'skyGridIntegrity',v_run.sky_grid_integrity,'actionCount',v_run.action_count,'stormMinutes',v_run.storm_minutes,'campaignStage',v_run.campaign_stage,'experience',v_run.experience);

  insert into public.frontier_events(tenant_id,org_id,run_id,actor_user_id,action,idempotency_key,previous_revision,resulting_revision,before_state,resulting_state)
  values(p_org_id,p_org_id,v_run.id,v_user_id,p_action,btrim(p_idempotency_key),v_run.revision-1,v_run.revision,v_before,v_after)
  returning id into v_event_id;

  return jsonb_build_object('ok',true,'idempotent',false,'revision',v_run.revision,'state',v_after,'event_id',v_event_id);
end;
$$;

revoke all on function public.frontier_apply_action(uuid,text,text) from public,anon;
grant execute on function public.frontier_apply_action(uuid,text,text) to authenticated;
