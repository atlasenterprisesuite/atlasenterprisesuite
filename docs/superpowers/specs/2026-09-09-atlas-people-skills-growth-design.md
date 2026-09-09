# ATLAS People — Skills & Growth Design

**Date:** 2026-09-09  
**Owner:** ATLAS People  
**Integration branch:** `release/atlas-a-z`  
**Working branch:** `feature/people-skills-growth-work`  
**Tracking issue:** #59  
**Backend target:** Supabase v2 (`atlas-core-v2`)  
**Status:** Approved design, not production-verified

## 1. Purpose

ATLAS People Skills & Growth turns a static skills/interests survey pattern into a governed enterprise capability that can represent what a person claims to know, what has been validated, what has evidence, what is stale, what a target role requires, and what concrete learning or work action can close a gap.

The feature must support employees, candidates, HR/talent users, managers, learning administrators, and downstream ATLAS modules without fabricating skill readiness or production state.

The core flow is:

`Person → Skills → Interests → Evidence → Validation → Gap Analysis → Growth Actions → Opportunity Match`

The feature is not a résumé generator and is not an automatic expert-ranking system. Self-declared information remains distinguishable from validated or credentialed evidence.

## 2. Existing ATLAS context

The A-Z branch already contains ATLAS People routes for Time & Attendance, Payroll, Compensation, Recruiting, and Employee Self-Service. Existing People code uses ATLAS identity permissions and Supabase-backed repositories/writes. The v2 backend uses explicit `tenant_id + org_id` isolation, centralized RBAC/RLS, audit logs, module registry, and governed mutation patterns.

Skills & Growth must reuse those boundaries rather than create a parallel identity or persistence layer.

## 3. Product ownership and integrations

### Primary owner

ATLAS People.

### Secondary integrations

- Recruiting: compare candidates and requisitions against validated skills.
- Employee Self-Service: let a person manage their own skills, interests, evidence, and goals.
- Education / Learning: turn gaps into learning actions and track evidence of completion.
- Analytics: aggregate organization skill coverage without exposing data across tenant boundaries.
- Knowledge Atlas: map skills to validated learning concepts and knowledge domains.
- AI / Automation: explain matches, suggest next actions, and monitor stale evidence, but never promote a skill to validated status without governed evidence.

## 4. Routes and navigation

### Organization view

`/people/skills`

Authorized HR/talent users see organization-scoped skills intelligence with these sections:

- Skills Inventory
- Interests
- Evidence Queue
- Gap Analysis
- Growth Plans
- Opportunity Match

The page supports search, filters, sorting, pagination where needed, empty/loading/error/success states, and deep links into an employee or role context.

### Self-service view

`/people/self-service/skills`

The current authenticated employee can:

- add or remove self-declared skills;
- set a self-assessed proficiency;
- add interests;
- attach or reference evidence metadata;
- define growth goals;
- view validation state;
- view explainable role/project/learning matches;
- see what evidence is missing or stale.

The employee cannot approve their own validation state unless a future explicit policy allows a credential source to do so automatically.

### Navigation integration

- Add a `Skills & Growth` card/link to ATLAS People when the user has an authorized skill permission.
- Add `Skills & Growth` inside Employee Self-Service for a user who can access their own profile.
- Preserve existing People routes and behavior.

## 5. Skill truth model

Every person-skill relationship has separate fields for claim, proficiency, source, validation, evidence, and freshness.

### Proficiency scale

Use a simple, explainable five-level scale:

1. `awareness` — recognizes concepts and terminology.
2. `foundational` — can perform basic tasks with guidance.
3. `working` — can independently perform common tasks.
4. `advanced` — handles complex work and can guide others.
5. `expert` — sustained high-level mastery backed by strong evidence.

No algorithm may assign `expert` from self-declaration alone.

### Source types

- `self_declared`
- `manager_validated`
- `assessment`
- `credential`
- `work_evidence`

### Validation state

- `claimed`
- `evidence_submitted`
- `validated`
- `rejected`
- `expired`

The display must never collapse these states into one generic “verified” badge.

### Evidence freshness

Evidence may have `issued_at`, `expires_at`, and `last_verified_at`. When a credential or evidence item expires, the skill remains historically recorded but its validation contribution becomes stale/expired.

## 6. Initial skill catalog domains

The first supported catalog must include organizational categories, not seeded personal claims:

- Accounting & Finance
- Bookkeeping
- Payroll
- Accounts Payable / Accounts Receivable
- Human Resources
- Excel & Data Analysis
- Business Administration
- Customer Service
- Operations & Logistics
- Project Management
- Entrepreneurship / Small Business
- Artificial Intelligence & Technology
- Cloud / Digital Tools
- Tax Preparation
- Languages

Catalog entries can later be expanded by authorized HR/talent users.

## 7. Supabase v2 data model

All scoped tables use both `tenant_id` and `org_id`, with composite organization foreign keys following the v2 foundation pattern.

### `people_skill_catalog`

Organization-owned skill vocabulary.

Required fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `code text not null`
- `name text not null`
- `category text not null`
- `description text`
- `active boolean not null default true`
- `created_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(org_id, code)`
- foreign key `(org_id, tenant_id)` to organizations
- normalized non-empty code/name/category checks

### `people_employee_skills`

Employee-to-skill relationship.

Required fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `employee_id uuid not null`
- `skill_id uuid not null`
- `proficiency_level text not null`
- `source text not null`
- `validation_state text not null default 'claimed'`
- `confidence numeric(4,3)` nullable, range `0..1`
- `last_verified_at timestamptz`
- `validated_by uuid`
- `created_at timestamptz`
- `updated_at timestamptz`

Constraints:

- unique `(org_id, employee_id, skill_id)`
- allowed proficiency/source/validation values
- scope-consistent employee and skill foreign keys

### `people_skill_evidence`

Evidence attached to an employee skill.

Required fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `employee_skill_id uuid not null`
- `evidence_type text not null`
- `title text not null`
- `issuer text`
- `reference_uri text`
- `issued_at timestamptz`
- `expires_at timestamptz`
- `status text not null default 'submitted'`
- `reviewed_by uuid`
- `reviewed_at timestamptz`
- `review_note text`
- `created_at timestamptz`
- `updated_at timestamptz`

Allowed evidence types:

- `assessment`
- `credential`
- `work_sample`
- `manager_attestation`
- `training_completion`
- `other`

Allowed statuses:

- `submitted`
- `accepted`
- `rejected`
- `expired`

### `people_interests`

Employee interests independent from validated skills.

Fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `employee_id uuid not null`
- `interest_code text not null`
- `label text not null`
- `priority smallint not null default 3` constrained `1..5`
- `created_at timestamptz`
- `updated_at timestamptz`

Unique `(org_id, employee_id, interest_code)`.

### `people_growth_goals`

Fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `employee_id uuid not null`
- `target_skill_id uuid`
- `target_role_code text`
- `target_proficiency_level text`
- `status text not null default 'active'`
- `target_date date`
- `created_at timestamptz`
- `updated_at timestamptz`

Allowed status: `active`, `completed`, `paused`, `cancelled`.

### `people_learning_actions`

A concrete action associated with a growth goal.

Fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `growth_goal_id uuid not null`
- `action_type text not null`
- `title text not null`
- `source_name text`
- `source_uri text`
- `status text not null default 'planned'`
- `due_date date`
- `completed_at timestamptz`
- `created_at timestamptz`
- `updated_at timestamptz`

Allowed action type: `course`, `assessment`, `credential`, `project`, `mentorship`, `practice`, `other`.

Allowed status: `planned`, `in_progress`, `completed`, `cancelled`.

### `people_role_skill_requirements`

Required to make role gap analysis deterministic rather than AI-only.

Fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `role_code text not null`
- `role_title text not null`
- `skill_id uuid not null`
- `required_proficiency_level text not null`
- `required boolean not null default true`
- `weight numeric(6,3) not null default 1`
- `created_at timestamptz`
- `updated_at timestamptz`

Unique `(org_id, role_code, skill_id)`.

### `people_opportunity_matches`

Persisted explainable snapshots of an evaluated match, not a source of truth for skill validation.

Fields:

- `id uuid primary key`
- `tenant_id uuid not null`
- `org_id uuid not null`
- `employee_id uuid not null`
- `opportunity_type text not null`
- `opportunity_ref text not null`
- `score numeric(5,2) not null` constrained `0..100`
- `explanation jsonb not null`
- `calculated_at timestamptz not null`
- `expires_at timestamptz`
- `created_at timestamptz`

Allowed opportunity type: `role`, `project`, `learning`.

The `explanation` JSON must contain the skill strengths, missing required skills, proficiency gaps, evidence-state caveats, and rule version used to calculate the score.

## 8. Employee identity linkage

Skills require a stable employee/person row. The v2 implementation must not assume the legacy People schema is already migrated into `atlas-core-v2` unless verified.

The implementation therefore has two valid paths:

1. Reuse a v2 employee/profile table if one exists at implementation time and satisfies tenant/org isolation.
2. If no verified v2 employee table exists, add the minimum v2 People profile identity required by Skills & Growth as part of the same People data-layer slice, preserving compatibility with the web module’s employee identifiers.

The implementation must fail closed rather than connect v2 skill rows to an unverified or cross-project employee identifier.

## 9. Permissions

Add explicit People skill permissions to the v2 permission catalog:

- `skills.self.read`
- `skills.self.write`
- `skills.read`
- `skills.write`
- `skills.validate`
- `skills.catalog.manage`
- `skills.growth.manage`
- `skills.match.read`

Default policy intent:

- employee/self-service: `skills.self.read`, `skills.self.write`, `skills.match.read` for own employee row only;
- HR/talent reader: `skills.read`, `skills.match.read`;
- HR/talent manager: `skills.read`, `skills.write`, `skills.validate`, `skills.catalog.manage`, `skills.growth.manage`, `skills.match.read`.

Exact role grants follow existing ATLAS role naming from v2 identity. No route may rely only on client-side permission checks; RLS and governed writes are authoritative.

## 10. RLS and mutation governance

### Read policies

- Organization-wide skill data requires `skills.read` for the same `tenant_id + org_id`.
- A user with self permissions can read only skill/interests/goals/evidence rows tied to their own employee identity in the current organization.
- Cross-tenant and cross-org reads are blocked.

### Writes

Direct authenticated INSERT/UPDATE/DELETE should be revoked for governed validation-sensitive tables.

Use the same hardened v2 pattern already adopted elsewhere:

`public SECURITY INVOKER wrapper → private SECURITY DEFINER implementation`

Governed RPCs should cover at minimum:

- self-declare or update own skill;
- remove own self-declared skill;
- add/update own interest;
- submit evidence;
- validate/reject evidence;
- create/update growth goal;
- manage catalog entry;
- define/update role skill requirement;
- calculate and persist opportunity match snapshot.

Server code derives actor identity and organization scope from authenticated identity context where possible. Validation writes record actor/time and create audit events.

## 11. Audit requirements

Audit at minimum:

- catalog create/update/deactivate;
- employee skill create/update/remove;
- evidence submit/accept/reject/expire;
- validation state changes;
- growth goal create/update/status changes;
- role requirement create/update/delete;
- opportunity match recalculation when persisted.

Audit events include tenant/org scope, actor, entity, before/after state where appropriate, and correlation ID.

## 12. Gap analysis algorithm

Gap analysis is deterministic and explainable.

For each role requirement:

1. Look up the employee skill for the required skill.
2. If missing, mark `missing_skill`.
3. If present, compare proficiency ordinal against required proficiency.
4. Apply evidence state:
   - `validated` or accepted current credential/work evidence supports readiness;
   - `claimed` is visible but cannot satisfy a validation-required condition;
   - `expired` or stale evidence creates a freshness caveat.
5. Report the exact shortfall in proficiency levels and evidence state.

No opaque model score may override these facts.

## 13. Opportunity matching algorithm

The first release uses a transparent weighted rule model.

For a role with requirements `i`:

- map proficiency levels to ordinals 1..5;
- `skill_ratio_i = min(employee_level / required_level, 1)` when a skill exists, otherwise `0`;
- `evidence_factor_i = 1.0` for validated/current evidence, `0.8` for accepted but aging evidence, `0.6` for self-claimed only, `0` for rejected/expired-only evidence;
- `weighted_i = weight_i * skill_ratio_i * evidence_factor_i`;
- score = `100 * sum(weighted_i) / sum(weight_i)`.

If a required skill is missing, the explanation must say so even if the total score remains high because of other strengths.

The score is an advisory match indicator, not a hiring decision and not proof of qualification.

Store a `rule_version` inside the match explanation, initially `skills-match-v1`.

## 14. UI behavior

### Organization Skills Inventory

Display:

- employee name/context permitted by current role;
- skill name/category;
- proficiency;
- validation state;
- evidence freshness;
- last verified date;
- source.

Support search by employee/skill and filters by category, proficiency, validation state, stale evidence, and interest.

### Evidence Queue

HR/talent validators see submitted evidence with:

- employee;
- skill;
- evidence type/title;
- issuer/reference;
- issue/expiry dates;
- current status;
- review action.

Accept/reject actions require `skills.validate`, confirmation, and a review note for rejection.

### Gap Analysis

For a selected employee and target role, show:

- strengths that meet/exceed target;
- proficiency gaps;
- missing skills;
- evidence gaps;
- stale/expired evidence;
- recommended next action category.

### Growth Plan

Show active goals and learning actions. Completing a learning action does not automatically validate a skill unless accepted evidence is created by a governed source or validator.

### Opportunity Match

Show score plus a plain explanation of why the match exists. Never show only a score.

## 15. Error and empty states

Required states:

- no employee identity linked;
- no skill catalog entries;
- no self-declared skills;
- no matching role requirements;
- no submitted evidence;
- backend unavailable;
- permission denied;
- validation conflict/stale write;
- cross-scope request blocked;
- successful save/validation.

No state may display synthetic organization metrics when real data is absent.

## 16. Frontend architecture

Add a focused Skills domain under ATLAS People rather than expanding `PeopleHome.tsx` into a large feature file.

Recommended files:

- `apps/web/src/modules/people/skills/SkillsRoutes.tsx`
- `apps/web/src/modules/people/skills/SkillsInventoryPage.tsx`
- `apps/web/src/modules/people/skills/SelfServiceSkillsPage.tsx`
- `apps/web/src/modules/people/skills/EvidenceQueuePage.tsx`
- `apps/web/src/modules/people/skills/GapAnalysisPage.tsx`
- `apps/web/src/modules/people/skills/GrowthPlanPage.tsx`
- `apps/web/src/modules/people/skills/OpportunityMatchPage.tsx`
- `apps/web/src/modules/people/skills/SkillsDataProvider.tsx`
- `apps/web/src/modules/people/skills/SkillsWriteProvider.tsx`

Shared domain code belongs under:

- `packages/people/src/skills/types.ts`
- `packages/people/src/skills/gapAnalysis.ts`
- `packages/people/src/skills/matching.ts`
- `packages/people/src/skills/repository.ts`
- `packages/people/src/skills/supabaseRepository.ts`
- `packages/people/src/skills/writes.ts`

The router adds the organization and self-service routes without breaking existing paths.

## 17. Backend migration structure

Target Supabase v2 migrations as a coherent People Skills slice, using ledger timestamps assigned when the migration is actually applied. Repository filenames created before provider application may use pending/plan status until exact ledger timestamps are verified.

Logical migration units:

1. Skills schema/tables/indexes.
2. Permissions + module registry + RLS.
3. Governed public/private RPC writes + audit.
4. Self-check function.
5. Backend gate extension.

If provider access is unavailable, code can be staged and tested locally/repository-side but must remain explicitly `pending` and not be documented as applied or verified in Supabase.

## 18. Tests

### Unit tests

- proficiency ordering;
- gap classification;
- evidence factor behavior;
- match score calculation;
- required-skill missing explanation;
- expired evidence handling;
- no self-declared path to automatic expert validation.

### Repository/integration tests

- maps Supabase rows to typed domain records;
- current tenant/org scope is always passed;
- self-service repository returns only own employee rows;
- validator writes require validation permission;
- errors preserve a typed failure result.

### UI tests

- People navigation conditionally shows Skills & Growth;
- organization skills route renders permitted data;
- self-service route renders only own profile;
- filters/search change displayed rows;
- evidence accept/reject flow handles success/error;
- gap view renders missing/proficiency/evidence gaps;
- match view renders score plus explanation;
- empty/loading/permission states are covered.

### Supabase E2E

Use transaction-wrapped fixtures ending in rollback.

Verify:

- same-tenant/org allowed reads/writes;
- cross-org blocked;
- cross-tenant blocked;
- self-service cannot validate own evidence;
- HR validator can validate within scope;
- direct DML restrictions hold where governed RPCs are required;
- public mutation wrappers are not exposed as `SECURITY DEFINER`;
- audit events are created;
- self-check returns all pass;
- backend gate includes Skills & Growth only after its component is applied.

### Security advisor

After provider application, rerun Supabase Security Advisor and require zero newly introduced findings before calling the backend slice verified.

## 19. Production and truth-state gates

The feature advances through distinct states:

1. `designed`
2. `implemented`
3. `repository-tested`
4. `backend-applied`
5. `backend-verified`
6. `release-integrated`
7. `deployed`
8. `publicly-verified`

A successful repository build does not mean Supabase migrations were applied, Cloudflare deployed the build, or the public domain serves it.

Do not use `live`, `online`, `connected`, `ready`, or `verified` without direct evidence for the corresponding layer.

## 20. Acceptance criteria

Skills & Growth is release-ready only when all of the following are true:

- `/people/skills` and `/people/self-service/skills` are implemented and navigable;
- desktop/tablet/mobile behavior is usable;
- Supabase persistence uses v2 `tenant_id + org_id` scope;
- RLS blocks cross-scope data;
- governed validation writes are audited;
- self-service CRUD works for own skills/interests/goals;
- HR validation flow works within authorized scope;
- catalog CRUD is permission-gated;
- search/filter/sort work on organization skills inventory;
- deterministic gap analysis works;
- explainable match scoring works;
- unit/integration/UI tests pass;
- Supabase E2E passes after provider application;
- security verification shows no new findings;
- no fabricated metrics or status claims exist;
- integration occurs through `release/atlas-a-z` before any production deployment decision.

## 21. Explicit non-goals for v1

- automatic hiring decisions;
- psychometric/personality scoring;
- compensation decisions based solely on skill score;
- external credential-provider integrations without an authorized provider;
- AI-generated validation states;
- synthetic organization-wide metrics;
- automatic promotion of training completion to expert proficiency;
- replacing the existing Recruiting or Employee Self-Service modules.

## 22. Future extensions

After v1 is verified, later iterations may add:

- external credential verification adapters;
- learning-provider integrations;
- manager endorsement workflow;
- project staffing suggestions;
- organization skill heatmaps;
- succession planning;
- role-family career ladders;
- AI coaching grounded in validated skill evidence;
- candidate-to-role matching using the same explainable requirement model.
