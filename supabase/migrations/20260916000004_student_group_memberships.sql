-- A student keeps a home class, and may also belong to different
-- subject groups such as IT, MB, or TA.
create table public.student_group_memberships (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  group_class_id uuid not null references public.classes(id) on delete cascade,
  subject_id uuid references public.subjects(id) on delete cascade,
  valid_from date not null default current_date,
  valid_until date,
  created_at timestamptz not null default now(),
  unique (student_id, group_class_id, subject_id),
  check (valid_until is null or valid_until >= valid_from)
);

alter table public.student_group_memberships enable row level security;

create policy "school group memberships readable"
  on public.student_group_memberships for select
  using (school_id = public.current_school_id());

create policy "manager manages group memberships"
  on public.student_group_memberships for all
  using (public.is_staff_manager() and school_id = public.current_school_id())
  with check (public.is_staff_manager() and school_id = public.current_school_id());

create index student_group_memberships_lookup
  on public.student_group_memberships (group_class_id, subject_id, student_id);
