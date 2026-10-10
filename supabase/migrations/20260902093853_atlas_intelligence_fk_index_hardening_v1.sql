create index if not exists atlas_ai_messages_conversation_id_idx
  on public.atlas_ai_messages(conversation_id);

create index if not exists atlas_ai_requests_conversation_id_idx
  on public.atlas_ai_requests(conversation_id);
