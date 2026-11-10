# -*- coding: utf-8 -*-
"""一次性資料庫變更：students 加上 stopped_at 欄位（停課日）

使用者 2026-11-10 要求：已停課名單要依停課日由近到遠排序，
否則剛停課的學生會被壓在清單最下面找不到。原本用「最後繳費日」排序並不可靠，
因為剛停課的人往往正是很久沒繳費的那個。

只做這一件事：

    ALTER TABLE students ADD COLUMN IF NOT EXISTS stopped_at timestamptz;

性質：
  - 新增可為空的欄位，不動任何現有資料
  - 冪等（IF NOT EXISTS），重複執行無害
  - 要還原：ALTER TABLE students DROP COLUMN stopped_at;

⚠️ 現有停課學生無法回填 —— 系統從未記錄狀態變更時間，沒有任何依據可推算。
   他們的 stopped_at 會是 NULL，在清單中排在有停課日者之後。

⚠️ 這支會寫資料庫。日常查詢一律走 tools/db_select.py（唯讀）。
⚠️ repo 是公開的：腳本不含任何姓名等個人資料。

    py tools/migrate_add_stopped_at.py
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import connect, query

DDL = 'ALTER TABLE students ADD COLUMN IF NOT EXISTS stopped_at timestamptz'


def cols():
    _c, rows = query("""SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_schema='public' AND table_name='students'
                          AND column_name IN ('status','stopped_at','deleted_at')
                        ORDER BY column_name""")
    return '、'.join(f'{a}({b.split()[0]},null={c})' for a, b, c in rows)


def main():
    print('執行前：', cols())
    before = query('SELECT count(*) FROM students')[1][0][0]

    print(f'\n要執行的語句：\n  {DDL}\n')
    with connect() as conn:                       # 這裡「不」設 read_only
        with conn.cursor() as cur:
            cur.execute(DDL)
        conn.commit()
    print('✅ 已執行')

    print('\n執行後：', cols())
    after = query('SELECT count(*) FROM students')[1][0][0]
    _c, r = query("""SELECT count(*) FILTER (WHERE status='停課'),
                            count(stopped_at) FILTER (WHERE status='停課')
                     FROM students WHERE deleted_at IS NULL""")
    print(f'  學生筆數：{before} → {after}（應相同）')
    print(f'  停課學生 {r[0][0]} 位，其中已有停課日 {r[0][1]} 位（舊資料無法回填，屬預期）')


if __name__ == '__main__':
    main()
