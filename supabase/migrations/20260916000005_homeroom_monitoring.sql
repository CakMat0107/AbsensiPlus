drop policy if exists "lessons teacher or managed" on public.lessons;
create policy "lessons teacher or homeroom readable" on public.lessons for select
  using (
    school_id = public.current_school_id()
    and (
      teacher_id = auth.uid()
      or public.is_staff_manager()
      or exists (
        select 1 from public.classes c
        where c.id = lessons.class_id
          and c.homeroom_teacher_id = auth.uid()
      )
    )
  );

drop policy if exists "student attendance teacher or managed" on public.student_attendance;
create policy "student attendance teacher or homeroom readable" on public.student_attendance for select
  using (
    exists (
      select 1 from public.lessons l
      left join public.classes c on c.id = l.class_id
      where l.id = student_attendance.lesson_id
        and l.school_id = public.current_school_id()
        and (
          l.teacher_id = auth.uid()
          or public.is_staff_manager()
          or c.homeroom_teacher_id = auth.uid()
        )
    )
  );
