-- Create a profile whenever a Supabase Auth user is created.
-- Set school_id in raw_user_meta_data when inviting users; otherwise the
-- first school is used for the initial single-school deployment.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_school uuid;
  selected_role public.app_role;
begin
  selected_school := nullif(new.raw_user_meta_data->>'school_id', '')::uuid;
  if selected_school is null then
    select id into selected_school from public.schools order by created_at limit 1;
  end if;
  if selected_school is null then
    raise exception 'Buat minimal satu sekolah sebelum membuat user';
  end if;

  selected_role := coalesce(
    nullif(new.raw_user_meta_data->>'role', '')::public.app_role,
    'guru'::public.app_role
  );

  insert into public.profiles (id, school_id, full_name, role)
  values (
    new.id,
    selected_school,
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), new.email),
    selected_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Safe to run repeatedly. Replace the name only if the deployment is still empty.
insert into public.schools (name)
select 'Sekolah Demo AbsensiPlus'
where not exists (select 1 from public.schools);
