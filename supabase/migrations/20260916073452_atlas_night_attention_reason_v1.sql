alter table public.atlas_night_queue add column attention_reason text;
create index atlas_night_queue_attention_reason_idx
  on public.atlas_night_queue (tenant_id, org_id, attention_reason)
  where attention_reason is not null;
