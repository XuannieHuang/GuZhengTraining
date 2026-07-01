-- =====================================================================
-- B. 老師異動歷史
-- 學生換老師時自動記一筆（何時、從誰 → 到誰）
-- 到 Supabase → SQL Editor → 貼上全部 → Run（可重複執行）
-- =====================================================================

create table if not exists teacher_changes (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid references students(id) on delete cascade,
  from_teacher_id uuid references teachers(id) on delete set null,
  to_teacher_id   uuid references teachers(id) on delete set null,
  changed_at      timestamptz default now()
);
create index if not exists idx_tchanges_student on teacher_changes(student_id);

alter table teacher_changes enable row level security;

-- RLS：與其他表一致。若已跑過 C1（白名單），就用 is_allowed()；否則退回「登入即可」
drop policy if exists auth_all on teacher_changes;
do $$
begin
  if exists (select 1 from pg_proc where proname='is_allowed') then
    execute 'create policy auth_all on teacher_changes for all to authenticated using (public.is_allowed()) with check (public.is_allowed())';
  else
    execute 'create policy auth_all on teacher_changes for all to authenticated using (true) with check (true)';
  end if;
end $$;
