-- ATLAS Private Oracle — owner-scoped persistence and one-time private entitlement snapshot.
-- Phase 1 intentionally does not auto-entitle future platform administrators.

create table if not exists public.oracle_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  entitlement_key text not null check (entitlement_key in ('atlas.oracle.private')),
  granted_at timestamptz not null default now(),
  primary key (user_id, entitlement_key)
);

insert into public.oracle_entitlements(user_id, entitlement_key)
select user_id, 'atlas.oracle.private'
from public.atlas_platform_admins
where enabled = true
on conflict (user_id, entitlement_key) do nothing;

create table if not exists public.oracle_decks (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  version integer not null default 1 check (version > 0),
  expected_card_count integer not null check (expected_card_count > 0),
  verified_card_count integer not null check (verified_card_count >= 0),
  is_complete boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.oracle_cards (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.oracle_decks(id) on delete cascade,
  slug text not null,
  title text not null,
  short_message text not null,
  long_message text not null,
  category text not null check (category in ('trust','intuition','acceptance','inner-light','guidance','peace')),
  image_asset_key text,
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (deck_id, slug),
  unique (deck_id, position)
);

create table if not exists public.oracle_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  organization_id uuid references public.organizations(id) on delete set null,
  deck_id uuid not null references public.oracle_decks(id) on delete restrict,
  reading_type text not null check (reading_type in ('daily','love','money','work','emotional','spiritual','full')),
  prompt_context text,
  interpretation jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.oracle_reading_cards (
  id uuid primary key default gen_random_uuid(),
  reading_id uuid not null references public.oracle_readings(id) on delete cascade,
  card_id uuid not null references public.oracle_cards(id) on delete restrict,
  spread_position text not null,
  sequence integer not null check (sequence >= 0),
  created_at timestamptz not null default now(),
  unique (reading_id, sequence),
  unique (reading_id, card_id)
);

create table if not exists public.oracle_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reading_id uuid not null references public.oracle_readings(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, reading_id)
);

create table if not exists public.oracle_favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  card_id uuid not null references public.oracle_cards(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, card_id)
);

create or replace function public.has_oracle_entitlement(entitlement_key text default 'atlas.oracle.private')
returns boolean
language sql
stable
security definer
set search_path = public, auth, pg_temp
as $$
  select exists (
    select 1
    from public.oracle_entitlements e
    where e.user_id = (select auth.uid())
      and e.entitlement_key = has_oracle_entitlement.entitlement_key
  );
$$;

revoke all on function public.has_oracle_entitlement(text) from public;
grant execute on function public.has_oracle_entitlement(text) to authenticated;

alter table public.oracle_entitlements enable row level security;
alter table public.oracle_decks enable row level security;
alter table public.oracle_cards enable row level security;
alter table public.oracle_readings enable row level security;
alter table public.oracle_reading_cards enable row level security;
alter table public.oracle_notes enable row level security;
alter table public.oracle_favorites enable row level security;

drop policy if exists oracle_entitlements_select_own on public.oracle_entitlements;
create policy oracle_entitlements_select_own on public.oracle_entitlements
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists oracle_decks_select_entitled on public.oracle_decks;
create policy oracle_decks_select_entitled on public.oracle_decks
  for select to authenticated
  using (public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_cards_select_entitled on public.oracle_cards;
create policy oracle_cards_select_entitled on public.oracle_cards
  for select to authenticated
  using (public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_readings_select_own on public.oracle_readings;
create policy oracle_readings_select_own on public.oracle_readings
  for select to authenticated
  using ((select auth.uid()) = user_id and public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_readings_insert_own on public.oracle_readings;
create policy oracle_readings_insert_own on public.oracle_readings
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_readings_update_own on public.oracle_readings;
create policy oracle_readings_update_own on public.oracle_readings
  for update to authenticated
  using ((select auth.uid()) = user_id and public.has_oracle_entitlement('atlas.oracle.private'))
  with check ((select auth.uid()) = user_id and public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_readings_delete_own on public.oracle_readings;
create policy oracle_readings_delete_own on public.oracle_readings
  for delete to authenticated
  using ((select auth.uid()) = user_id and public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_reading_cards_select_owned_reading on public.oracle_reading_cards;
create policy oracle_reading_cards_select_owned_reading on public.oracle_reading_cards
  for select to authenticated
  using (exists (
    select 1 from public.oracle_readings r
    where r.id = reading_id and r.user_id = (select auth.uid())
  ));

drop policy if exists oracle_reading_cards_insert_owned_reading on public.oracle_reading_cards;
create policy oracle_reading_cards_insert_owned_reading on public.oracle_reading_cards
  for insert to authenticated
  with check (exists (
    select 1 from public.oracle_readings r
    where r.id = reading_id and r.user_id = (select auth.uid())
  ));

drop policy if exists oracle_notes_select_own on public.oracle_notes;
create policy oracle_notes_select_own on public.oracle_notes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists oracle_notes_insert_own on public.oracle_notes;
create policy oracle_notes_insert_own on public.oracle_notes
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.oracle_readings r where r.id = reading_id and r.user_id = (select auth.uid()))
  );

drop policy if exists oracle_notes_update_own on public.oracle_notes;
create policy oracle_notes_update_own on public.oracle_notes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists oracle_notes_delete_own on public.oracle_notes;
create policy oracle_notes_delete_own on public.oracle_notes
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists oracle_favorites_select_own on public.oracle_favorites;
create policy oracle_favorites_select_own on public.oracle_favorites
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists oracle_favorites_insert_own on public.oracle_favorites;
create policy oracle_favorites_insert_own on public.oracle_favorites
  for insert to authenticated
  with check ((select auth.uid()) = user_id and public.has_oracle_entitlement('atlas.oracle.private'));

drop policy if exists oracle_favorites_delete_own on public.oracle_favorites;
create policy oracle_favorites_delete_own on public.oracle_favorites
  for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.oracle_entitlements from anon;
revoke all on public.oracle_decks from anon;
revoke all on public.oracle_cards from anon;
revoke all on public.oracle_readings from anon;
revoke all on public.oracle_reading_cards from anon;
revoke all on public.oracle_notes from anon;
revoke all on public.oracle_favorites from anon;

grant select on public.oracle_entitlements to authenticated;
grant select on public.oracle_decks to authenticated;
grant select on public.oracle_cards to authenticated;
grant select, insert, update, delete on public.oracle_readings to authenticated;
grant select, insert on public.oracle_reading_cards to authenticated;
grant select, insert, update, delete on public.oracle_notes to authenticated;
grant select, insert, delete on public.oracle_favorites to authenticated;

insert into public.oracle_decks(slug, name, description, version, expected_card_count, verified_card_count, is_complete, is_active)
values (
  'mensajes-oraculo-mistico',
  'Mensajes del Oráculo Místico',
  'ATLAS reflective oracle deck. Phase 1 includes only cards verified from the approved source.',
  1,
  44,
  7,
  false,
  true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  expected_card_count = 44,
  verified_card_count = 7,
  is_complete = false,
  is_active = true,
  updated_at = now();

with deck as (
  select id from public.oracle_decks where slug = 'mensajes-oraculo-mistico'
), verified_cards(slug, title, short_message, long_message, category, position) as (
  values
    ('confia','CONFÍA','Suelta el control y permite que la vida te guíe.','Suelta el control y permite que la vida te guíe. Todo sucede en el momento perfecto.','trust',1),
    ('escucha','ESCUCHA','Baja el ruido y presta atención a tu intuición.','Tu intuición susurra la verdad que tu mente aún no comprende. Silencia el ruido y escucha tu alma.','intuition',2),
    ('acepta','ACEPTA','Reconoce lo que es para poder elegir tu siguiente paso.','Lo que es, simplemente es. Desde la aceptación, encuentras paz y transformas tu realidad.','acceptance',3),
    ('luz-interior','LUZ INTERIOR','Reconoce la claridad y fortaleza que ya existen en ti.','Vuelve a tu centro y observa con honestidad la claridad, la capacidad y la fortaleza que ya existen en ti.','inner-light',4),
    ('intuicion','INTUICIÓN','Escucha la percepción interna sin confundirla con certeza objetiva.','Observa las sensaciones e ideas que se repiten y úsalas como material de reflexión, contrastándolas con hechos cuando tomes decisiones importantes.','intuition',5),
    ('guia-divina','GUÍA DIVINA','Busca dirección en valores, propósito y acciones concretas.','Permite que tus valores, tu propósito y las oportunidades reales que tienes delante orienten el siguiente paso.','guidance',6),
    ('paz-del-alma','PAZ DEL ALMA','Protege un espacio de calma antes de reaccionar.','Haz espacio para descansar, ordenar lo que sientes y volver a una respuesta más serena antes de actuar.','peace',7)
)
insert into public.oracle_cards(deck_id, slug, title, short_message, long_message, category, position, is_active)
select deck.id, c.slug, c.title, c.short_message, c.long_message, c.category, c.position, true
from deck cross join verified_cards c
on conflict (deck_id, slug) do update set
  title = excluded.title,
  short_message = excluded.short_message,
  long_message = excluded.long_message,
  category = excluded.category,
  position = excluded.position,
  is_active = true,
  updated_at = now();
