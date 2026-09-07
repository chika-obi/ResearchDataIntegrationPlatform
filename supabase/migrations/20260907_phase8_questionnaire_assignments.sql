-- RDIP Phase 8: Questionnaire Assignments
-- Safe, additive migration. No existing Phase 4-7 tables are replaced.

create table if not exists public.questionnaire_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  questionnaire_id uuid not null references public.questionnaires(id) on delete cascade,
  questionnaire_version_id uuid not null references public.questionnaire_versions(id) on delete restrict,
  enumerator_id uuid not null references public.profiles(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'active' check (status in ('active','paused','revoked','completed')),
  start_date timestamptz,
  end_date timestamptz,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questionnaire_assignments_project_idx on public.questionnaire_assignments(project_id);
create index if not exists questionnaire_assignments_questionnaire_idx on public.questionnaire_assignments(questionnaire_id);
create index if not exists questionnaire_assignments_version_idx on public.questionnaire_assignments(questionnaire_version_id);
create index if not exists questionnaire_assignments_enumerator_idx on public.questionnaire_assignments(enumerator_id);

-- Prevent duplicate active assignments of the same published instrument to the same enumerator.
create unique index if not exists questionnaire_assignments_active_unique
  on public.questionnaire_assignments(questionnaire_version_id, enumerator_id)
  where status = 'active';

alter table public.questionnaire_assignments enable row level security;

-- Researchers may view assignments they created.
create policy "researchers can view own questionnaire assignments"
on public.questionnaire_assignments
for select
to authenticated
using (assigned_by = auth.uid());

-- Enumerators may view only assignments assigned to their profile.
create policy "enumerators can view their questionnaire assignments"
on public.questionnaire_assignments
for select
to authenticated
using (enumerator_id = auth.uid());

-- Creation is restricted to the authenticated researcher through the existing profile role model.
create policy "researchers can create questionnaire assignments"
on public.questionnaire_assignments
for insert
to authenticated
with check (
  assigned_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and lower(coalesce(p.role, '')) = 'researcher'
  )
  and exists (
    select 1 from public.questionnaire_versions v
    where v.id = questionnaire_version_id
      and v.questionnaire_id = questionnaire_id
      and v.status = 'published'
  )
  and exists (
    select 1 from public.questionnaires q
    where q.id = questionnaire_id
      and q.project_id = project_id
  )
);

-- Do not allow client-side status/project/questionnaire/enumerator reassignment.
-- Updates are intentionally omitted here; later phases can introduce controlled lifecycle transitions.

comment on table public.questionnaire_assignments is 'RDIP Phase 8 authoritative assignments of published questionnaire versions to enumerators';
comment on column public.questionnaire_assignments.questionnaire_version_id is 'Exact published instrument version assigned for field collection';
