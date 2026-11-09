# -*- coding: utf-8 -*-
"""一次性資料修正：把 students 的「最後繳費」對回 payments 的最新一筆

背景：modal-payevent.js 的編輯／刪除／退費三個路徑過去只動 payments，
沒有同步 students.last_pay_date／last_pay_amount，於是留下不一致的殘留值。
程式面已於 2026-11-09 修好（syncLastPay），這支只負責清掉既有的殘留。

規則與 syncLastPay 一致：
  · 取該生「金額為正」的最新一筆繳費（退費不算最後繳費）
  · 同日多筆時取較晚建立的那筆
  · **只動「至少有一筆正數 payments」的學生** —— 另有 53 位的最後繳費日來自早期
    匯入、完全沒有 payments，不在範圍內，不會被清空

⚠️ 這支會寫入資料庫。日常查詢一律走 tools/db_select.py（唯讀）。
⚠️ 這個 repo 是公開的：腳本只用條件式 SQL，不寫入任何姓名等個人資料。

    py tools/migrate_fix_last_pay.py
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import connect, query

LATEST = """
  SELECT student_id, pay_date, amount FROM (
    SELECT student_id, pay_date, amount,
           row_number() OVER (PARTITION BY student_id
                              ORDER BY pay_date DESC, created_at DESC) rn
    FROM payments WHERE amount > 0) t WHERE rn = 1
"""

PREVIEW = f"""
WITH latest AS ({LATEST})
SELECT count(*) FROM students s JOIN latest l ON l.student_id = s.id
WHERE s.last_pay_date IS DISTINCT FROM l.pay_date
   OR s.last_pay_amount IS DISTINCT FROM l.amount
"""

DML = f"""
WITH latest AS ({LATEST})
UPDATE students s
   SET last_pay_date = l.pay_date,
       last_pay_amount = l.amount
  FROM latest l
 WHERE s.id = l.student_id
   AND (s.last_pay_date IS DISTINCT FROM l.pay_date
        OR s.last_pay_amount IS DISTINCT FROM l.amount)
"""


def main():
    before = query(PREVIEW)[1][0][0]
    print(f'執行前：{before} 位的「最後繳費」與 payments 不一致')
    if not before:
        print('沒有需要修正的資料，結束。')
        return

    print('\n要執行的語句：')
    print('\n'.join('  ' + x for x in DML.strip().split('\n')))

    with connect() as conn:                       # 這裡「不」設 read_only
        with conn.cursor() as cur:
            cur.execute(DML)
            changed = cur.rowcount
        conn.commit()
    print(f'\n✅ 已更新 {changed} 列')

    after = query(PREVIEW)[1][0][0]
    print(f'執行後：{after} 位不一致' + ('（已全部對上）' if after == 0 else ' ⚠️ 仍有殘留'))

    _c, r = query("""SELECT count(*) FROM students s
                     WHERE s.last_pay_date IS NOT NULL
                       AND NOT EXISTS (SELECT 1 FROM payments p
                                       WHERE p.student_id = s.id AND p.amount > 0)""")
    print(f'未被碰到（匯入歷史，沒有任何正數 payments）：{r[0][0]} 位')


if __name__ == '__main__':
    main()
