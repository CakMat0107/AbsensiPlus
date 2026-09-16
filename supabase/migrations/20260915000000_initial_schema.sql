create extension if not exists "uuid-ossp";

create type public.app_role as enum ('admin', 'kepala_sekolah', 'wali_kelas', 'guru');
create type public.request_status as enum ('menunggu', 'disetujui', 'ditolak');
create type public.attendance_status as enum ('hadir', 'izin', 'sakit', 'alpa');

create table public.schools (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id),
  full_name text not null,
  role public.app_role not null default 'guru',
  homeroom text,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  homeroom_teacher_id uuid references public.profiles(id),
  unique (school_id, name)
);

create table public.students (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id),
  full_name text not null,
  student_number text,
  created_at timestamptz not null default now()
);

create table public.subjects (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  unique (school_id, name)
);

create table public.teaching_schedules (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  class_id uuid not null references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  weekday smallint not null check (weekday between 1 and 7),
  start_time time not null,
  end_time time not null
);

create table public.staff_attendance (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  attendance_date date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  note text,
  unique (user_id, attendance_date)
);

create table public.requests (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  request_type text not null check (request_type in ('cuti', 'tugas_luar')),
  start_date date not null,
  end_date date not null,
  reason text not null,
  status public.request_status not null default 'menunggu',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table public.substitute_assignments (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  requester_id uuid not null references public.profiles(id),
  substitute_id uuid not null references public.profiles(id),
  assignment_date date not null,
  lesson text not null,
  class_id uuid not null references public.classes(id),
  reason text not null,
  status public.request_status not null default 'menunggu',
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.lessons (
  id uuid primary key default uuid_generate_v4(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  class_id uuid not null references public.classes(id),
  subject_id uuid not null references public.subjects(id),
  lesson_date date not null default current_date,
  created_at timestamptz not null default now()
);

create table public.student_attendance (
  id uuid primary key default uuid_generate_v4(),
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  student_id uuid not null references public.students(id),
  status public.attendance_status not null,
  note text,
  unique (lesson_id, student_id)
);

create or replace function public.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select * from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.current_profile()).role in ('admin', 'kepala_sekolah'), false)
$$;

alter table public.profiles enable row level security;
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.subjects enable row level security;
alter table public.teaching_schedules enable row level security;
alter table public.staff_attendance enable row level security;
alter table public.requests enable row level security;
alter table public.substitute_assignments enable row level security;
alter table public.lessons enable row level security;
alter table public.student_attendance enable row level security;

create policy "profiles same school" on public.profiles for select
  using (school_id = (public.current_profile()).school_id);
create policy "manager updates profiles" on public.profiles for update
  using (public.is_staff_manager());
create policy "school data readable" on public.schools for select
  using (id = (public.current_profile()).school_id);
create policy "school classes readable" on public.classes for select
  using (school_id = (public.current_profile()).school_id);
create policy "manager manages classes" on public.classes for all
  using (public.is_staff_manager()) with check (public.is_staff_manager());
create policy "school students readable" on public.students for select
  using (school_id = (public.current_profile()).school_id);
create policy "manager manages students" on public.students for all
  using (public.is_staff_manager()) with check (public.is_staff_manager());
create policy "school subjects readable" on public.subjects for select
  using (school_id = (public.current_profile()).school_id);
create policy "manager manages subjects" on public.subjects for all
  using (public.is_staff_manager()) with check (public.is_staff_manager());
create policy "school schedules readable" on public.teaching_schedules for select
  using (school_id = (public.current_profile()).school_id);
create policy "manager manages schedules" on public.teaching_schedules for all
  using (public.is_staff_manager()) with check (public.is_staff_manager());

create policy "staff own attendance" on public.staff_attendance for all
  using (user_id = auth.uid() or public.is_staff_manager())
  with check (user_id = auth.uid() or public.is_staff_manager());
create policy "requests own or managed" on public.requests for all
  using (user_id = auth.uid() or public.is_staff_manager())
  with check (user_id = auth.uid() or public.is_staff_manager());
create policy "assignments school access" on public.substitute_assignments for all
  using (school_id = (public.current_profile()).school_id)
  with check (school_id = (public.current_profile()).school_id);
create policy "lessons teacher or managed" on public.lessons for all
  using (teacher_id = auth.uid() or public.is_staff_manager())
  with check (teacher_id = auth.uid() or public.is_staff_manager());
create policy "student attendance teacher or managed" on public.student_attendance for all
  using (exists (
    select 1 from public.lessons l
    where l.id = lesson_id and (l.teacher_id = auth.uid() or public.is_staff_manager())
  ))
  with check (exists (
    select 1 from public.lessons l
    where l.id = lesson_id and (l.teacher_id = auth.uid() or public.is_staff_manager())
  ));

alter publication supabase_realtime add table public.staff_attendance;
alter publication supabase_realtime add table public.requests;
alter publication supabase_realtime add table public.substitute_assignments;
alter publication supabase_realtime add table public.student_attendance;
