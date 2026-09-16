-- Avoid recursive RLS evaluation when policies need the current user's school
-- or role. These SECURITY DEFINER scalar helpers read one profile row without
-- re-entering the profiles policies.
create or replace function public.current_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin', 'kepala_sekolah'), false)
$$;

drop policy if exists "profiles same school" on public.profiles;
drop policy if exists "manager updates profiles" on public.profiles;
create policy "profiles same school" on public.profiles for select
  using (school_id = public.current_school_id());
create policy "manager updates profiles" on public.profiles for update
  using (public.is_staff_manager())
  with check (school_id = public.current_school_id());

drop policy if exists "school data readable" on public.schools;
create policy "school data readable" on public.schools for select
  using (id = public.current_school_id());

drop policy if exists "school classes readable" on public.classes;
drop policy if exists "manager manages classes" on public.classes;
create policy "school classes readable" on public.classes for select
  using (school_id = public.current_school_id());
create policy "manager manages classes" on public.classes for all
  using (public.is_staff_manager() and school_id = public.current_school_id())
  with check (public.is_staff_manager() and school_id = public.current_school_id());

drop policy if exists "school students readable" on public.students;
drop policy if exists "manager manages students" on public.students;
create policy "school students readable" on public.students for select
  using (school_id = public.current_school_id());
create policy "manager manages students" on public.students for all
  using (public.is_staff_manager() and school_id = public.current_school_id())
  with check (public.is_staff_manager() and school_id = public.current_school_id());

drop policy if exists "school subjects readable" on public.subjects;
drop policy if exists "manager manages subjects" on public.subjects;
create policy "school subjects readable" on public.subjects for select
  using (school_id = public.current_school_id());
create policy "manager manages subjects" on public.subjects for all
  using (public.is_staff_manager() and school_id = public.current_school_id())
  with check (public.is_staff_manager() and school_id = public.current_school_id());

drop policy if exists "school schedules readable" on public.teaching_schedules;
drop policy if exists "manager manages schedules" on public.teaching_schedules;
create policy "school schedules readable" on public.teaching_schedules for select
  using (school_id = public.current_school_id());
create policy "manager manages schedules" on public.teaching_schedules for all
  using (public.is_staff_manager() and school_id = public.current_school_id())
  with check (public.is_staff_manager() and school_id = public.current_school_id());

drop policy if exists "staff own attendance" on public.staff_attendance;
create policy "staff own attendance" on public.staff_attendance for all
  using (
    school_id = public.current_school_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  )
  with check (
    school_id = public.current_school_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );

drop policy if exists "requests own or managed" on public.requests;
create policy "requests own or managed" on public.requests for all
  using (
    school_id = public.current_school_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  )
  with check (
    school_id = public.current_school_id()
    and (user_id = auth.uid() or public.is_staff_manager())
  );

drop policy if exists "assignments school access" on public.substitute_assignments;
create policy "assignments school access" on public.substitute_assignments for all
  using (school_id = public.current_school_id())
  with check (school_id = public.current_school_id());

drop policy if exists "lessons teacher or managed" on public.lessons;
create policy "lessons teacher or managed" on public.lessons for all
  using (
    school_id = public.current_school_id()
    and (teacher_id = auth.uid() or public.is_staff_manager())
  )
  with check (
    school_id = public.current_school_id()
    and (teacher_id = auth.uid() or public.is_staff_manager())
  );
