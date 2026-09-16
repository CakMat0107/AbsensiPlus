-- Backfill Auth users that existed before the profile trigger was installed.
insert into public.profiles (id, school_id, full_name, role)
select
  u.id,
  s.id,
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), u.email),
  coalesce(
    nullif(u.raw_user_meta_data->>'role', '')::public.app_role,
    'guru'::public.app_role
  )
from auth.users u
cross join lateral (
  select id from public.schools order by created_at limit 1
) s
where not exists (
  select 1 from public.profiles p where p.id = u.id
);
