-- =====================================================================
-- C1：Google 登入 + 白名單
-- 作用：把所有資料表的存取改成「登入者的 email 必須在 allowed_emails 白名單裡」
-- 到 Supabase → SQL Editor → 貼上全部 → Run
-- ⚠️ 跑之前，把下方「種子」區塊的 email 換成你們所有現有管理者的 email，
--    否則沒列進去的人會被鎖在外面（包含你自己！）
-- =====================================================================

-- 1) 白名單表
create table if not exists allowed_emails (
  email      text primary key,
  note       text,
  created_at timestamptz default now()
);
alter table allowed_emails enable row level security;

-- 2) 判斷「目前登入者是否在白名單」的函式
--    security definer：以函式擁有者身分執行、略過 RLS，避免在 allowed_emails 上遞迴
create or replace function public.is_allowed() returns boolean
  language sql security definer stable set search_path = public as $$
  select exists(
    select 1 from allowed_emails
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email',''))
  );
$$;

-- 3) allowed_emails 自己的 RLS：只有「已在白名單」的人能讀/改白名單
drop policy if exists ae_all on allowed_emails;
create policy ae_all on allowed_emails for all to authenticated
  using (public.is_allowed()) with check (public.is_allowed());

-- 4) 其他資料表：政策從「登入即可」改成「在白名單才可」
do $$ declare t text; begin
  foreach t in array array['teachers','plans','students','payments','rentals','rental_logs'] loop
    execute format('drop policy if exists auth_all on %I;', t);
    execute format('create policy auth_all on %I for all to authenticated using (public.is_allowed()) with check (public.is_allowed());', t);
  end loop;
end $$;

-- 5) 種子：先把現有管理者的 email 都加進白名單（不然會被鎖在外面）
--    ⚠️ 改成你們真正的 email（用 Google 登入時的那個 gmail）
insert into allowed_emails(email, note) values
  ('xuan7867@gmail.com','建立者')
  -- ,('manager2@gmail.com','管理者2')
  -- ,('manager3@gmail.com','管理者3')
on conflict (email) do nothing;
