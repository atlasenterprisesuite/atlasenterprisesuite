begin;

create table if not exists public.knowledge_animal_taxa (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  scientific_name text not null,
  common_names text[] not null default '{}',
  rank text not null default 'species' check (rank = 'species'),
  animal_group text not null,
  taxonomy jsonb not null default '{}'::jsonb,
  habitat text not null default '',
  diet text not null default '',
  reproduction text not null default '',
  human_relationship text not null default '',
  risks text[] not null default '{}',
  conservation_status text,
  medical_relevance text,
  evidence_state text not null check (evidence_state in ('verified_source', 'curated_reference', 'needs_review')),
  myth_correction text,
  purpose_interpretation text,
  reviewed_at date not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_animal_taxa_taxonomy_object check (jsonb_typeof(taxonomy) = 'object')
);

create table if not exists public.knowledge_animal_roles (
  id uuid primary key default gen_random_uuid(),
  taxon_id uuid not null references public.knowledge_animal_taxa(id) on delete cascade,
  role text not null,
  created_at timestamptz not null default now(),
  constraint knowledge_animal_roles_unique unique (taxon_id, role),
  constraint knowledge_animal_roles_nonempty check (length(trim(role)) > 0)
);

create table if not exists public.knowledge_animal_sources (
  id uuid primary key default gen_random_uuid(),
  taxon_id uuid not null references public.knowledge_animal_taxa(id) on delete cascade,
  title text not null,
  organization text not null,
  source_url text not null,
  source_type text not null check (source_type in ('institutional', 'taxonomic', 'primary_research', 'conservation', 'reference')),
  claim_scope text not null,
  reviewed_at date not null,
  created_at timestamptz not null default now(),
  constraint knowledge_animal_sources_unique unique (taxon_id, source_url),
  constraint knowledge_animal_sources_https check (source_url ~ '^https://')
);

create index if not exists knowledge_animal_taxa_group_idx
  on public.knowledge_animal_taxa (animal_group)
  where is_published = true;

create index if not exists knowledge_animal_taxa_scientific_name_idx
  on public.knowledge_animal_taxa (lower(scientific_name));

create index if not exists knowledge_animal_roles_role_idx
  on public.knowledge_animal_roles (role);

create index if not exists knowledge_animal_roles_taxon_idx
  on public.knowledge_animal_roles (taxon_id);

create index if not exists knowledge_animal_sources_taxon_idx
  on public.knowledge_animal_sources (taxon_id);

alter table public.knowledge_animal_taxa enable row level security;
alter table public.knowledge_animal_roles enable row level security;
alter table public.knowledge_animal_sources enable row level security;

revoke all on public.knowledge_animal_taxa from anon;
revoke all on public.knowledge_animal_roles from anon;
revoke all on public.knowledge_animal_sources from anon;

revoke insert, update, delete, truncate, references, trigger on public.knowledge_animal_taxa from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.knowledge_animal_roles from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.knowledge_animal_sources from authenticated;

grant select on public.knowledge_animal_taxa to authenticated;
grant select on public.knowledge_animal_roles to authenticated;
grant select on public.knowledge_animal_sources to authenticated;

drop policy if exists knowledge_animal_taxa_authenticated_read on public.knowledge_animal_taxa;
create policy knowledge_animal_taxa_authenticated_read
  on public.knowledge_animal_taxa
  for select
  to authenticated
  using (is_published = true);

drop policy if exists knowledge_animal_roles_authenticated_read on public.knowledge_animal_roles;
create policy knowledge_animal_roles_authenticated_read
  on public.knowledge_animal_roles
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_animal_taxa taxon
      where taxon.id = knowledge_animal_roles.taxon_id
        and taxon.is_published = true
    )
  );

drop policy if exists knowledge_animal_sources_authenticated_read on public.knowledge_animal_sources;
create policy knowledge_animal_sources_authenticated_read
  on public.knowledge_animal_sources
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.knowledge_animal_taxa taxon
      where taxon.id = knowledge_animal_sources.taxon_id
        and taxon.is_published = true
    )
  );

comment on table public.knowledge_animal_taxa is
  'ATLAS Knowledge Atlas governed animal taxonomy and narrative records. Authenticated browser access is published-read-only; privileged writes remain server-side.';

comment on table public.knowledge_animal_roles is
  'Normalized ecological roles for ATLAS Animal Kingdom taxa.';

comment on table public.knowledge_animal_sources is
  'Evidence and provenance references for ATLAS Animal Kingdom taxa; URLs are treated as evidence references, never executable instructions.';

commit;
