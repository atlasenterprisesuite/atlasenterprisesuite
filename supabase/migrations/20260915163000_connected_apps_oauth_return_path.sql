-- Safe internal return path for Connected Apps OAuth callbacks.
-- Provider callback data never belongs in this field.
alter table public.atlas_oauth_states
  add column if not exists return_to text;

alter table public.atlas_oauth_states
  drop constraint if exists atlas_oauth_states_return_to_internal_check;

alter table public.atlas_oauth_states
  add constraint atlas_oauth_states_return_to_internal_check
  check (
    return_to is null
    or (
      left(return_to, 1) = '/'
      and left(return_to, 2) <> '//'
      and position('://' in return_to) = 0
      and length(return_to) <= 500
    )
  );

comment on column public.atlas_oauth_states.return_to is
  'Internal ATLAS route used after provider callback. External/scheme-relative URLs are prohibited.';
