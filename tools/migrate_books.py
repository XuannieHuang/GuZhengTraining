# -*- coding: utf-8 -*-
"""一次性資料庫變更：課本管理（第 1 期）

建立兩張表與 Storage 的存放空間，規格見 課本管理規劃.md：

    books        課本主檔（名稱／售價／數量／存放區域／封面／備註）
    book_moves   數量異動流水（kind = 進貨 / 盤點）

RLS 比照現有所有表：僅 authenticated，且必須通過 public.is_allowed()
（白名單檢查，定義在資料庫裡）。

Storage：建一個 private 的 books bucket 放封面。
⚠️ storage.objects 的擁有者是 supabase_storage_admin，本連線用的 postgres
   不是它的成員，所以那幾條 policy 可能建不起來 —— 腳本會分開回報，
   失敗的話到 Supabase 後台手動加（畫面上會印出要加什麼）。

性質：
  - 全部冪等（IF NOT EXISTS / ON CONFLICT / DROP POLICY IF EXISTS），重複執行無害
  - 不動任何現有資料表
  - 要還原：DROP TABLE book_moves, books;  DELETE FROM storage.buckets WHERE id='books';

⚠️ 這支會寫資料庫。日常查詢一律走 tools/db_select.py（唯讀）。
⚠️ repo 是公開的：腳本不含任何姓名等個人資料。

    py tools/migrate_books.py
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import connect, query

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

TABLES = [
    ('books', """
        CREATE TABLE IF NOT EXISTS public.books (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          name        text NOT NULL,
          price       int,
          qty         int  NOT NULL DEFAULT 0,
          location    text,
          photo_path  text,
          note        text,
          active      boolean DEFAULT true,
          deleted_at  timestamptz,
          created_at  timestamptz DEFAULT now()
        )"""),
    ('book_moves', """
        CREATE TABLE IF NOT EXISTS public.book_moves (
          id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          book_id     uuid REFERENCES public.books(id),
          kind        text NOT NULL,
          move_date   date NOT NULL DEFAULT current_date,
          qty_before  int NOT NULL,
          qty_after   int NOT NULL,
          note        text,
          created_at  timestamptz DEFAULT now()
        )"""),
]

INDEXES = [
    "CREATE INDEX IF NOT EXISTS book_moves_book_idx ON public.book_moves(book_id, move_date DESC)",
    "CREATE INDEX IF NOT EXISTS books_active_idx    ON public.books(deleted_at, location)",
]

# 跟 plans / teachers 等既有表完全一樣的寫法
def rls(t):
    return [
        f"ALTER TABLE public.{t} ENABLE ROW LEVEL SECURITY",
        f"DROP POLICY IF EXISTS auth_all ON public.{t}",
        f"""CREATE POLICY auth_all ON public.{t} FOR ALL TO authenticated
            USING (is_allowed()) WITH CHECK (is_allowed())""",
    ]

BUCKET = """
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('books', 'books', false)
    ON CONFLICT (id) DO NOTHING"""

# 封面只有登入且在白名單裡的人能存取，跟資料表同一個條件
STORAGE_POLICIES = [
    "DROP POLICY IF EXISTS books_auth_all ON storage.objects",
    """CREATE POLICY books_auth_all ON storage.objects FOR ALL TO authenticated
       USING (bucket_id = 'books' AND is_allowed())
       WITH CHECK (bucket_id = 'books' AND is_allowed())""",
]


def run(conn, sql, label):
    """執行一句，回報成敗。失敗不中斷，讓其餘步驟照跑。"""
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print(f'  OK   {label}')
        return True
    except Exception as e:
        conn.rollback()
        print(f'  FAIL {label}\n       {str(e).splitlines()[0]}')
        return False


def main():
    print('課本管理（第 1 期）— 建立資料表與 Storage\n')
    storage_ok = True
    with connect() as conn:                       # 這裡「不」設 read_only
        print('資料表')
        for name, ddl in TABLES:
            run(conn, ddl, f'建立 {name}')
        for sql in INDEXES:
            run(conn, sql, '索引 ' + sql.split()[5])

        print('\nRLS（僅 authenticated ＋ 白名單）')
        for name, _ in TABLES:
            for sql in rls(name):
                run(conn, sql, f'{name}：' + sql.split()[0] + ' ' + sql.split()[1])

        print('\nStorage')
        storage_ok &= run(conn, BUCKET, "建立 bucket 'books'（private）")
        for sql in STORAGE_POLICIES:
            storage_ok &= run(conn, sql, 'storage.objects：' + sql.split()[0] + ' ' + sql.split()[1])

    print('\n執行後確認')
    _c, r = query("""SELECT table_name FROM information_schema.tables
                     WHERE table_schema='public' AND table_name IN ('books','book_moves')
                     ORDER BY 1""")
    print('  資料表：', '、'.join(x[0] for x in r) or '（沒有）')
    _c, r = query("""SELECT tablename, policyname FROM pg_policies
                     WHERE schemaname='public' AND tablename IN ('books','book_moves')
                     ORDER BY 1""")
    print('  RLS policy：', '、'.join(f'{a}.{b}' for a, b in r) or '（沒有）')
    _c, r = query("SELECT id, public FROM storage.buckets WHERE id='books'")
    print('  bucket：', r[0] if r else '（沒有）')
    _c, r = query("""SELECT policyname FROM pg_policies
                     WHERE schemaname='storage' AND policyname='books_auth_all'""")
    print('  storage policy：', r[0][0] if r else '（沒有）')

    if not r:
        print("""
⚠️ storage.objects 的 policy 沒建起來（擁有者是 supabase_storage_admin，
   本連線的 postgres 不是它的成員）。請到 Supabase 後台手動加一條：

   Storage → Policies → storage.objects → New policy
     Policy name : books_auth_all
     Allowed op  : SELECT, INSERT, UPDATE, DELETE（全選）
     Target roles: authenticated
     USING       : bucket_id = 'books' AND is_allowed()
     WITH CHECK  : bucket_id = 'books' AND is_allowed()

   沒有這條的話，App 傳不了也讀不到封面。""")


if __name__ == '__main__':
    main()
