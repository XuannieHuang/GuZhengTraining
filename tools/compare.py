# -*- coding: utf-8 -*-
"""2026 財務報表 x 系統：第二步 — 對帳

系統這一側用 students.last_pay_date / last_pay_amount（你實際維護的「目前繳到哪」），
不用 payments 流水表 —— 它 2026-05 才啟用，涵蓋不到全年。

輸出：
  data/對帳結果.csv      逐位學生：報表 vs 系統，標出誰沒更新
  data/缺漏學生清單.csv   報表有收款、系統查無此人（附逐筆明細供辨識）
"""
import os, re, csv, io, sys, datetime, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import query
import reconcile as R

OUT = R.OUT
FEE_CATS = {'學費'}          # 對帳只比學費與租箏，其餘類別另計
RENT_CATS = {'租箏'}
TOL_DAYS = 10                # 記帳日與系統登記日的合理落差，視為同一筆
#   依實測落差分布決定：41 人同日、少數差 1-2 天，最遠 8 天，下一個才跳到 22 天
EXCLUDE_FILE = '排除名單.txt'  # 廖主任自己控管的學生等，列在這裡就不算缺漏


def dump(path, rows, cols, key):
    with io.open(path, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
        w.writeheader()
        w.writerows(sorted(rows, key=key))
    return path


def load_exclude():
    """讀「不需我們處理」的姓名（廖主任自己控管的學生等），一行一個，# 開頭是註解"""
    path = os.path.join(OUT, EXCLUDE_FILE)
    if not os.path.exists(path):
        return set()
    names = set()
    for line in io.open(path, encoding='utf-8'):
        line = line.split('#')[0].strip()
        if line:
            names.add(R.norm(line))
    return names


def main():
    excluded = load_exclude()
    canon, teachers = R.load_canon()
    py_index = collections.defaultdict(list)
    for n in canon:
        py_index[''.join(R.lazy_pinyin(n))].append(n)

    raw, recs = R.build_records(teachers)
    written = {r['報表寫法'] for r in recs}

    # ── 重建姓名 → student_id 對應（與第一步同一套規則）──────────
    agg = collections.defaultdict(lambda: {'筆數': 0, '金額': 0.0,
                                           '類別': collections.Counter(),
                                           '老師提示': set(), '收款人欄': set()})
    for r in recs:
        g = agg[r['報表寫法']]
        g['筆數'] += 1
        g['金額'] += r['金額']
        g['類別'][r['類別']] += 1
        if r['老師提示']:
            g['老師提示'].add(r['老師提示'])
        g['收款人欄'].add(r['收款人欄'])

    name2sid, how_of = {}, {}
    for name, g in agg.items():
        hit, how = R.match(name, g, canon, py_index, written)
        if hit:
            name2sid[name] = canon[hit][0]['id']
            how_of[name] = how

    # ── 報表側：依 student_id 彙總 ────────────────────────────
    rep = collections.defaultdict(lambda: {'學費筆': 0, '學費額': 0.0, '學費末日': None,
                                           '學費末額': 0.0, '租箏筆': 0, '租箏額': 0.0,
                                           '租箏末日': None, '其他額': 0.0})
    orphan = collections.defaultdict(list)          # 對不到系統的報表明細
    for r in recs:
        sid = name2sid.get(r['報表寫法'])
        if not sid:
            if set(agg[r['報表寫法']]['類別']) - R.EXCLUDE_CATS:   # 純體驗/樂團的不列
                orphan[r['報表寫法']].append(r)
            continue
        b = rep[sid]
        if r['類別'] in FEE_CATS:
            b['學費筆'] += 1
            b['學費額'] += r['金額']
            if not b['學費末日'] or r['日期'] > b['學費末日']:
                b['學費末日'], b['學費末額'] = r['日期'], r['金額']
        elif r['類別'] in RENT_CATS:
            b['租箏筆'] += 1
            b['租箏額'] += r['金額']
            if not b['租箏末日'] or r['日期'] > b['租箏末日']:
                b['租箏末日'] = r['日期']
        else:
            b['其他額'] += r['金額']

    # ── 系統側 ──────────────────────────────────────────────
    _c, srows = query("""SELECT s.id, s.name, COALESCE(t.name,''), s.status, s.plan,
                                s.attended, s.last_pay_date, s.last_pay_amount, s.instrument
                         FROM students s LEFT JOIN teachers t ON t.id = s.teacher_id""")
    _c, prows = query("""SELECT DISTINCT ON (student_id) student_id, pay_date,
                                COALESCE(periods,1) * amount AS 實收
                         FROM payments ORDER BY student_id, pay_date DESC""")
    pay_sys = {sid: (pd, tot) for sid, pd, tot in prows}

    # 租借用 student_id 連，但 student_id 只是「存檔時剛好同名就順手連」的方便欄位
    # （modal-rental.js saveRental），連不上很正常 → 再用 renter_name 補一次
    _c, rrows = query("""SELECT student_id, renter_name, max(pay_date), max(due_date), max(status)
                         FROM rentals GROUP BY student_id, renter_name""")
    rent_sys, rent_by_name = {}, {}
    for sid, rname, pd, dd, stt in rrows:
        if sid:
            rent_sys[sid] = (pd, dd, stt)
        elif rname:
            rent_by_name[R.norm(rname)] = (pd, dd, stt)

    out, miss_in_report = [], 0
    for sid, name, tch, st, plan, att, lpd, lpa, inst in srows:
        b = rep.get(sid)
        row = {'姓名': name, '老師': tch, '狀態': st, '樂器': inst or '', '方案': plan or '',
               '已上堂數': att if att is not None else '',
               '系統最後繳費': lpd or '', '系統金額': lpa or '',
               '報表學費筆': b['學費筆'] if b else 0,
               '報表學費額': round(b['學費額']) if b else 0,
               '報表最後繳費': b['學費末日'] if b and b['學費末日'] else '',
               '報表金額': round(b['學費末額']) if b and b['學費末日'] else '',
               '報表租箏筆': b['租箏筆'] if b else 0,
               '報表租箏額': round(b['租箏額']) if b else 0}

        rs = rent_sys.get(sid) or rent_by_name.get(R.norm(name))
        row['系統租箏繳費'] = rs[0] if rs and rs[0] else ''
        row['系統租箏到期'] = rs[1] if rs and rs[1] else ''
        row['系統租箏狀態'] = rs[2] if rs else ''

        # 租箏對帳
        rr = b['租箏末日'] if b and b['租箏末日'] else None
        sr = rs[0] if rs else None
        if not rr and not sr:
            row['租箏對帳'] = ''
        elif rr and not sr:
            row['租箏對帳'] = '⚠️ 報表有租箏、系統沒有租借記錄'
        elif sr and not rr:
            row['租箏對帳'] = '🟡 系統有租借、2026 報表沒收到租金'
        elif abs((rr - sr).days) <= TOL_DAYS:
            row['租箏對帳'] = '✅ 相符'
        elif rr > sr:
            row['租箏對帳'] = f'🔴 系統落後：報表 {rr} 已收，系統停在 {sr}'
        else:
            row['租箏對帳'] = f'🟡 帳本落後：系統 {sr}，報表最後只到 {rr}'

        rd, sd = row['報表最後繳費'] or None, lpd
        if not b or not b['學費筆']:
            if st in ('停課', '退學'):
                row['對帳結果'] = '⬜ 正常（已停課/退學）'
                row['差異'] = ''
            else:
                row['對帳結果'] = '⚠️ 在學但 2026 報表沒收到學費'
                row['差異'] = '可能預繳未到期，或帳本漏記'
                miss_in_report += 1
        elif not sd:
            row['對帳結果'] = '⚠️ 系統沒有繳費日'
            row['差異'] = '報表有收款但系統未填 last_pay_date'
        elif rd and abs((rd - sd).days) <= TOL_DAYS:
            row['對帳結果'] = '✅ 相符'
            row['差異'] = '' if rd == sd else f'記帳日差 {abs((rd - sd).days)} 天，視為同一筆'
        elif rd and rd > sd:
            row['對帳結果'] = '🔴 系統落後'
            row['差異'] = f'報表 {rd} 已收 ${row["報表金額"]:,}，系統仍停在 {sd}（差 {(rd - sd).days} 天）'
        elif rd and rd < sd:
            row['對帳結果'] = '🟡 帳本落後'
            row['差異'] = f'系統 {sd} 已更新，報表最後只到 {rd}（差 {(sd - rd).days} 天）'
        elif (pay_sys.get(sid) and row['報表金額']
              and int(pay_sys[sid][1]) != int(row['報表金額'])):
            row['對帳結果'] = '🟠 日期同金額不符'
            row['差異'] = (f'系統實收 ${int(pay_sys[sid][1]):,}（期數×單期）'
                          f' vs 報表 ${int(row["報表金額"]):,}')
        else:
            row['對帳結果'] = '✅ 相符'
            row['差異'] = ''
        out.append(row)

    # ── 缺漏學生清單（報表有、系統無）──────────────────────────
    miss, skipped = [], []
    for name, rs in orphan.items():
        if R.norm(name) in excluded:
            skipped.append(name)
            continue
        fee = [x for x in rs if x['類別'] in FEE_CATS]
        miss.append({
            '報表寫法': name,
            '筆數': len(rs),
            '金額合計': round(sum(x['金額'] for x in rs)),
            '學費筆': len(fee),
            '老師提示': '/'.join(sorted({x['老師提示'] for x in rs if x['老師提示']})),
            '首次': min(x['日期'] for x in rs),
            '最後': max(x['日期'] for x in rs),
            '逐筆明細': ' ｜ '.join(f'{x["日期"]:%m/%d} {x["類別"]} ${x["金額"]:,.0f}' for x in
                               sorted(rs, key=lambda y: y['日期'])),
            '摘要原文': ' ｜ '.join(sorted({x['摘要'] for x in rs})),
        })

    os.makedirs(OUT, exist_ok=True)
    dump(os.path.join(OUT, '對帳結果.csv'), out,
         ['姓名', '老師', '狀態', '樂器', '方案', '已上堂數', '對帳結果', '差異',
          '系統最後繳費', '系統金額', '報表最後繳費', '報表金額',
          '報表學費筆', '報表學費額', '租箏對帳', '報表租箏筆', '報表租箏額',
          '系統租箏繳費', '系統租箏到期', '系統租箏狀態'],
         key=lambda r: (r['對帳結果'], r['姓名']))
    dump(os.path.join(OUT, '缺漏學生清單.csv'), miss,
         ['報表寫法', '筆數', '學費筆', '金額合計', '老師提示', '首次', '最後',
          '逐筆明細', '摘要原文'],
         key=lambda r: -r['金額合計'])

    # ── 摘要 ────────────────────────────────────────────────
    cc = collections.Counter(r['對帳結果'] for r in out)
    print(f'系統 {len(out)} 位學生對帳結果：')
    for k, v in cc.most_common():
        print(f'  {k:<22}{v:>3} 人')
    lag = [r for r in out if r['對帳結果'] == '🔴 系統落後']
    if lag:
        print(f'\n🔴 系統落後 {len(lag)} 人（報表已收款、系統還沒更新）：')
        for r in sorted(lag, key=lambda x: x['報表最後繳費'], reverse=True):
            print(f'  {r["姓名"]:<5}{r["老師"]:<5}已上 {r["已上堂數"]:<3}'
                  f'系統 {r["系統最後繳費"]} → 報表 {r["報表最後繳費"]} ${r["報表金額"]:,}')
    rc = collections.Counter(r['租箏對帳'].split('：')[0] for r in out if r['租箏對帳'])
    print('\n租箏對帳：')
    for k, v in rc.most_common():
        print(f'  {k:<32}{v:>3} 人')

    print(f'\n缺漏學生（報表有收款、系統查無此人）{len(miss)} 人，'
          f'${sum(r["金額合計"] for r in miss):,}')
    print('\n輸出：data/對帳結果.csv、data/缺漏學生清單.csv')


if __name__ == '__main__':
    main()
