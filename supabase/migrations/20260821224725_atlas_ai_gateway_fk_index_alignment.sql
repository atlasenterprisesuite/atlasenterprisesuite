create index if not exists atlas_ai_models_connector_fk_idx on public.atlas_ai_models(connector_id);
create index if not exists atlas_ai_routes_model_fk_idx on public.atlas_ai_routes(org_id, model_id);
