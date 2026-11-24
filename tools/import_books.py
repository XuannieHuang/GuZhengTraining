# -*- coding: utf-8 -*-
"""從盤點表的 Excel 把課本名稱匯入 books 表。

    py tools/import_books.py "C:\\path\\書籍盤點表.xlsx"

只讀「品項」那一欄的書名，其他欄位（售價、數量）一律留白 ——
盤點表裡本來就沒有這些資料，不猜。數量留 0，之後用 App 的盤點一次點進去。

**順序**：App 裡的課本清單要跟 Excel 一樣，所以把檔案裡的列順序寫進 books.sort。
重複執行會重新同步一次順序 —— 以後改了 Excel 的排法，再跑一次就好。

性質：
  - **冪等**：已經存在的書名不會重複新增（但 sort 會更新成檔案裡的順序）
  - 不刪除任何既有資料，也不動售價、數量、封面、備註
  - 要還原：DELETE FROM books WHERE qty=0 AND price IS NULL;

⚠️ 這支會寫資料庫。日常查詢一律走 tools/db_select.py（唯讀）。
⚠️ repo 是公開的：書名只從指令列傳進來的檔案讀，不寫進這支程式裡。
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import connect, query

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SKIP = ('書籍盤點表', '品項', '日期')   # 標題列，不是書名


def read_names(path):
    import openpyxl
    ws = openpyxl.load_workbook(path, data_only=True).worksheets[0]
    out, seen = [], set()
    for r in range(1, ws.max_row + 1):
        v = ws.cell(r, 1).value
        if v is None:
            continue
        # 全形空白、前後空白都清掉
        name = str(v).replace('\u3000', ' ').strip()
        if not name or any(k in name for k in SKIP):
            continue
        if name in seen:
            print(f'  （重複，跳過）{name}')
            continue
        seen.add(name)
        out.append(name)
    return out


def main():
    if len(sys.argv) < 2:
        sys.exit('用法：py tools/import_books.py <盤點表.xlsx>')
    path = sys.argv[1]
    if not os.path.exists(path):
        sys.exit(f'找不到檔案：{path}')

    names = read_names(path)
    print(f'從檔案讀到 {len(names)} 個書名\n')

    _c, rows = query('SELECT name FROM books WHERE deleted_at IS NULL')
    exist = {r[0] for r in rows}
    todo = [n for n in names if n not in exist]
    dup = [n for n in names if n in exist]

    if dup:
        print(f'已經在系統裡的 {len(dup)} 本：只更新順序，其他欄位不動')
    if todo:
        print()
        print(f'要新增 {len(todo)} 本：')
        for n in todo:
            print('  ·', n)

    with connect() as conn:                      # 這裡「不」設 read_only
        with conn.cursor() as cur:
            if todo:
                cur.executemany(
                    'INSERT INTO books (name, qty) VALUES (%s, 0)',
                    [(n,) for n in todo])
            # 順序＝檔案裡的列序（1 起算），讓 App 的清單跟 Excel 一樣
            cur.executemany(
                'UPDATE books SET sort = %s WHERE name = %s AND deleted_at IS NULL',
                [(i, n) for i, n in enumerate(names, 1)])
        conn.commit()

    _c, r = query('SELECT count(*) FROM books WHERE deleted_at IS NULL')
    print()
    print(f'✅ 新增 {len(todo)} 本、順序同步 {len(names)} 本，books 目前共 {r[0][0]} 本')
    _c, r = query("""SELECT sort, name FROM books WHERE deleted_at IS NULL
                     ORDER BY sort NULLS LAST, name LIMIT 4""")
    print('   排序後的前幾筆：')
    for i, n in r:
        print(f'     {i}. {n}')


if __name__ == '__main__':
    main()
