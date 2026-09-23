# -*- coding: utf-8 -*-
"""一次性資料庫變更：students 加上 deleted_at 欄位（註記刪除用）

使用者 2026-09-23 明確要求執行。只做這一件事：

    ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

性質：
  - 新增可為空的欄位，不動任何現有資料
  - 冪等（IF NOT EXISTS），重複執行無害
  - 要還原：ALTER TABLE students DROP COLUMN deleted_at;

⚠️ 這支是唯一會寫資料庫的程式。日常查詢一律走 tools/db_select.py（唯讀）。

    py tools/migrate_add_deleted_at.py
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import connect, query

DDL = 'ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at timestamptz'


def show_columns(tag):
    _c, rows = query("""SELECT column_name, data_type, is_nullable
                        FROM information_schema.columns
                        WHERE table_schema='public' AND table_name='students'
                          AND column_name IN ('status','deleted_at')""")
    print(f'  {tag}: ' + ('、'.join(f'{a}({b},null={c})' for a, b, c in rows) or '(沒有 deleted_at)'))


def main():
    print('執行前：')
    show_columns('students 相關欄位')
    _c, before = query('SELECT count(*) FROM students')

    print(f'\n要執行的語句：\n  {DDL}\n')
    with connect() as conn:                       # 這裡「不」設 read_only
        with conn.cursor() as cur:
            cur.execute(DDL)
        conn.commit()
    print('✅ 已執行')

    print('\n執行後：')
    show_columns('students 相關欄位')
    _c, after = query('SELECT count(*) FROM students')
    _c, dele = query('SELECT count(*) FROM students WHERE deleted_at IS NOT NULL')
    print(f'  學生筆數：{before[0][0]} → {after[0][0]}（應相同）')
    print(f'  已註記刪除：{dele[0][0]} 位')


if __name__ == '__main__':
    main()
