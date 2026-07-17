create extension if not exists pgcrypto;

-- =========================================================
-- BỔ SUNG THÔNG TIN NGƯỜI TẠO CASE
-- =========================================================

alter table public.class_sessions
add column if not exists
  created_by uuid
  references auth.users(id)
  on delete set null;

alter table public.class_sessions
add column if not exists
  description text
  not null default '';

alter table public.class_sessions
add column if not exists
  updated_at timestamptz
  not null default now();

create index if not exists
  class_sessions_created_by_idx
on public.class_sessions(created_by);

-- =========================================================
-- CHÍNH SÁCH CLASS SESSIONS
-- =========================================================

drop policy if exists
  "Read active class sessions"
on public.class_sessions;

create policy
  "Read active class sessions"
on public.class_sessions
for select
to authenticated
using (
  is_active = true
  or created_by = (
    select auth.uid()
  )
);

drop policy if exists
  "Creator inserts class sessions"
on public.class_sessions;

create policy
  "Creator inserts class sessions"
on public.class_sessions
for insert
to authenticated
with check (
  created_by = (
    select auth.uid()
  )
);

drop policy if exists
  "Creator updates class sessions"
on public.class_sessions;

create policy
  "Creator updates class sessions"
on public.class_sessions
for update
to authenticated
using (
  created_by = (
    select auth.uid()
  )
)
with check (
  created_by = (
    select auth.uid()
  )
);

drop policy if exists
  "Creator deletes class sessions"
on public.class_sessions;

create policy
  "Creator deletes class sessions"
on public.class_sessions
for delete
to authenticated
using (
  created_by = (
    select auth.uid()
  )
);

-- =========================================================
-- CHÍNH SÁCH CASE SECTIONS
-- =========================================================

drop policy if exists
  "Read case sections"
on public.case_sections;

create policy
  "Read case sections"
on public.case_sections
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions s
    where
      s.id =
        case_sections.session_id

      and (
        s.is_active = true

        or s.created_by = (
          select auth.uid()
        )
      )
  )
);

drop policy if exists
  "Creator manages case sections"
on public.case_sections;

create policy
  "Creator manages case sections"
on public.case_sections
for all
to authenticated
using (
  exists (
    select 1
    from public.class_sessions s
    where
      s.id =
        case_sections.session_id

      and s.created_by = (
        select auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.class_sessions s
    where
      s.id =
        case_sections.session_id

      and s.created_by = (
        select auth.uid()
      )
  )
);

-- =========================================================
-- CHÍNH SÁCH DECISION CRITERIA
-- =========================================================

drop policy if exists
  "Read decision criteria"
on public.decision_criteria;

create policy
  "Read decision criteria"
on public.decision_criteria
for select
to authenticated
using (
  exists (
    select 1
    from public.class_sessions s
    where
      s.id =
        decision_criteria.session_id

      and (
        s.is_active = true

        or s.created_by = (
          select auth.uid()
        )
      )
  )
);

drop policy if exists
  "Creator manages decision criteria"
on public.decision_criteria;

create policy
  "Creator manages decision criteria"
on public.decision_criteria
for all
to authenticated
using (
  exists (
    select 1
    from public.class_sessions s
    where
      s.id =
        decision_criteria.session_id

      and s.created_by = (
        select auth.uid()
      )
  )
)
with check (
  exists (
    select 1
    from public.class_sessions s
    where
      s.id =
        decision_criteria.session_id

      and s.created_by = (
        select auth.uid()
      )
  )
);

grant
  select,
  insert,
  update,
  delete
on public.class_sessions
to authenticated;

grant
  select,
  insert,
  update,
  delete
on public.case_sections
to authenticated;

grant
  select,
  insert,
  update,
  delete
on public.decision_criteria
to authenticated;