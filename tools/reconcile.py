# -*- coding: utf-8 -*-
"""2026 財務報表 x 系統：第一步 — 建立姓名對應表

規則（已與使用者確認）：
  1. 體驗課排除出學生對帳（仍計入收入）
  2. 樂團/比賽/押金 獨立類別，不算學費、不扣堂
  3. 一筆多人依摘要拆帳

輸出：data/name_map.csv、data/unmatched.csv
"""
import os, re, sys, csv, io, datetime, unicodedata, collections
import openpyxl
from pypinyin import lazy_pinyin

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db_select import query

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX = os.path.join(ROOT, '箏心古箏資料.xlsx')
OUT = os.path.join(ROOT, 'data')
YEAR = 2026

# 摘要裡代表「費用項目」的關鍵字；姓名一定出現在第一個關鍵字之前
KW = (r'(租琵琶|退箏|箏架|學費|租箏|體驗|樂團|爭霸賽|比賽|檢定|押金|訂金|退租|退費|'
      r'月繳|季繳|單堂|團體班|雙人|加課|補課|新生|琵琶)')
EXCLUDE_CATS = {'體驗課', '樂團', '比賽檢定', '押金', '退費'}


def norm(s):
    """正規化姓名：全半形統一、去括號註記、去空白"""
    if not s:
        return ''
    s = unicodedata.normalize('NFKC', str(s)).strip()
    s = re.sub(r'[（(].*?[)）]', '', s)
    return re.sub(r'[\s　]', '', s)


def category(memo, subject, amount):
    if amount < 0:
        return '退費'
    if re.search('體驗', memo):
        return '體驗課'
    if re.search('樂團', memo):
        return '樂團'
    if re.search('爭霸賽|比賽|檢定', memo):
        return '比賽檢定'
    if re.search('押金', memo):
        return '押金'
    return '租箏' if subject == '租箏收入' else '學費'


def split_items(memo, subject, amount):
    """一列可能含多個項目（宇涵租箏3600+押金5000）→ 只在金額加總吻合時才拆"""
    hits = re.findall(KW + r'\s*(\d+)', memo)
    if len(hits) >= 2:
        amts = [int(a) for _, a in hits]
        if sum(amts) == amount:
            return [(category(k, subject, a), a) for (k, _), a in zip(hits, amts)]
    return [(category(memo, subject, amount), amount)]


def people(memo):
    """從摘要抽出人名清單與實際人數（處理「母女」「N位」「*N」）"""
    m = re.sub(r'[（(].*?[)）]', '', unicodedata.normalize('NFKC', str(memo or '')))
    m = re.sub(r'^\s*(補記?|預收|退)?\s*\d{1,2}/\d{1,2}\s*', '', m)  # 補記帳：補2/1王小明學費
    head = re.split(KW, m)[0].strip()
    head = re.sub(r'\d.*$', '', head)                      # 第一個數字之後都不是名字

    n = 0
    mul = re.search(r'\*\s*(\d+)', m)
    if mul:
        n = int(mul.group(1))
    pos = re.search(r'(\d+)\s*位', m)
    if pos:
        n = int(pos.group(1))
    if '母女' in m and not n:
        n = 2

    head = re.sub(r'母女|兩位', '', head)
    names = [norm(x) for x in re.split(r'[、,，+＋/]', head) if norm(x)]
    return names, max(n, len(names), 1)


def lev(a, b):
    """編輯距離；差超過 1 個字長就不用算了"""
    if abs(len(a) - len(b)) > 1:
        return 9
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


STATUS_RANK = {'在學': 0, '新生': 1, '停課': 2, '退學': 3}


def load_canon():
    """系統名單；同名重複時優先取「在學/新生、繳費日最新」那筆"""
    _c, rows = query("SELECT s.id, s.name, COALESCE(t.name,''), s.status, s.last_pay_date "
                     "FROM students s LEFT JOIN teachers t ON t.id = s.teacher_id")
    canon = {}
    for sid, nm, tch, st, lpd in rows:
        n = norm(nm)
        if n:
            canon.setdefault(n, []).append({'id': sid, 'name': nm, 'teacher': tch,
                                            'status': st, 'last_pay_date': lpd})
    for v in canon.values():
        v.sort(key=lambda d: (STATUS_RANK.get(d['status'], 9),
                              -(d['last_pay_date'].toordinal() if d['last_pay_date'] else 0)))
    _c, trs = query("SELECT name FROM teachers")
    return canon, [t[0] for t in trs if t[0]]


def build_records(teachers):
    """讀報表 → 拆項目、拆人 → 逐人逐項紀錄"""
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    raw = [r for r in wb['流水會計帳'].iter_rows(min_row=2, values_only=True)
           if isinstance(r[0], datetime.datetime) and r[0].year == YEAR
           and r[1] in ('學費收入', '租箏收入')]

    recs = []
    for d, subj, memo, payer, amt, _note in raw:
        memo, amt = str(memo or ''), float(amt or 0)
        tchit = next((t for t in teachers if t in memo or t[1:] in memo), '')
        names, n_people = people(memo)
        if not names:
            names = [norm(payer)] if norm(payer) else ['(未具名)']
        for cat, a in split_items(memo, subj, amt):
            per = a / n_people
            for nm in names:
                recs.append({'日期': d.date(), '類別': cat, '報表寫法': nm,
                             '收款人欄': norm(payer), '金額': per,
                             '老師提示': tchit, '摘要': memo})
            if n_people > len(names):      # 例：樂團2000*3人、慧君母女2位 → 其餘人沒具名
                recs.append({'日期': d.date(), '類別': cat, '報表寫法': f'(未具名·{cat})',
                             '收款人欄': norm(payer), '金額': per * (n_people - len(names)),
                             '老師提示': tchit, '摘要': memo})
    return raw, recs


def match(name, g, canon, py_index, written):
    """比對層級：完全相同 → 補姓氏 → 同音(安全情境)；回傳 (命中的系統姓名, 方式)"""
    cands = [c for c in {name, *g['收款人欄']} if c]

    for c in cands:                                        # L1 完全相同
        if c in canon:
            return c, '完全相同'

    for c in cands:                                        # L2 補姓氏（唯一解）
        if len(c) == 2:
            sub = [k for k in canon if len(k) == 3 and k[1:] == c]
            if len(sub) > 1 and g['老師提示']:              # 用摘要裡的老師縮小範圍
                narrowed = [k for k in sub if canon[k][0]['teacher'] in g['老師提示']]
                sub = narrowed or sub
            if len(sub) == 1:
                return sub[0], '補姓氏'

    for c in cands:                                        # L3 字序顛倒（陳熙薇 / 陳薇熙）
        swap = [k for k in canon if k != c and len(k) == len(c) and sorted(k) == sorted(c)]
        safe = [k for k in swap if k not in written]
        if len(safe) == 1 and len(swap) == 1:
            return safe[0], '字序顛倒'

    for c in cands:                                        # L4 同音（正確姓名未出現在報表才採用）
        same = [k for k in py_index.get(''.join(lazy_pinyin(c)), []) if k != c]
        if len(same) == 1 and same[0] not in written:
            return same[0], '同音'

    return None, ''


def main():
    canon, teachers = load_canon()
    py_index = collections.defaultdict(list)
    for n in canon:
        py_index[''.join(lazy_pinyin(n))].append(n)

    raw, recs = build_records(teachers)
    written = {r['報表寫法'] for r in recs}

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

    NONPERSON = re.compile(r'^\(|^學生$|樂團|先生|小姐|老師|^[A-Za-z]+$')
    mapped, manual = [], []

    for name, g in agg.items():
        hit, how = match(name, g, canon, py_index, written)
        info = canon[hit][0] if hit else None
        row = {'報表寫法': name, '筆數': g['筆數'], '金額合計': round(g['金額']),
               '主要類別': g['類別'].most_common(1)[0][0],
               '老師提示': '/'.join(sorted(g['老師提示']))}

        if hit:
            row.update({'正確姓名': info['name'], 'student_id': info['id'],
                        '老師': info['teacher'], '學生狀態': info['status'],
                        '比對方式': how, '信心': '中' if how == '同音' else '高'})
            mapped.append(row)
            continue

        if set(g['類別']) <= EXCLUDE_CATS:
            row.update({'狀態': '排除（非學生對帳）', '候選': '',
                        '說明': '僅含體驗/樂團/比賽/押金/退費，不需對到學生'})
        elif NONPERSON.search(name):
            row.update({'狀態': '非人物/需人工', '候選': '',
                        '說明': '泛稱、稱謂、英文名或未具名'})
        else:
            cands = [c for c in {name, *g['收款人欄']} if c]
            homo = sorted({k for c in cands
                           for k in py_index.get(''.join(lazy_pinyin(c)), []) if k != c})
            near = sorted({k for c in cands for k in canon if lev(c, k) == 1})
            if homo:
                row.update({'狀態': '同音·兩者皆在報表', '候選': '、'.join(homo),
                            '說明': '兩種寫法都出現在報表，可能同一人也可能兩個真人'})
            elif near:
                row.update({'狀態': '差一字需確認', '候選': '、'.join(near), '說明': '形近或缺字'})
            else:
                row.update({'狀態': '查無此人', '候選': '', '說明': '系統名單沒有此人'})
        manual.append(row)

    os.makedirs(OUT, exist_ok=True)

    def dump(path, rows, cols):
        with io.open(path, 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore')
            w.writeheader()
            w.writerows(sorted(rows, key=lambda r: -r['金額合計']))

    dump(os.path.join(OUT, 'name_map.csv'), mapped,
         ['報表寫法', '正確姓名', 'student_id', '老師', '學生狀態', '比對方式', '信心',
          '主要類別', '筆數', '金額合計'])
    dump(os.path.join(OUT, 'unmatched.csv'), manual,
         ['報表寫法', '狀態', '候選', '說明', '老師提示', '主要類別', '筆數', '金額合計'])

    # ── 摘要 ──────────────────────────────────
    ca, cc = collections.Counter(), collections.Counter()
    for r in recs:
        cc[r['類別']] += 1
        ca[r['類別']] += r['金額']
    print(f'2026 學費/租箏 {len(raw)} 列 → 拆帳後 {len(recs)} 筆人次，'
          f'${sum(r["金額"] for r in recs):,.0f}\n')
    print('類別分布：')
    for k, v in cc.most_common():
        print(f'  {k:<6}{v:>4} 筆 {ca[k]:>12,.0f}')

    need = [r for r in manual if r['狀態'] != '排除（非學生對帳）']
    print(f'\n✅ 自動對上 {len(mapped)}/{len(agg)} 個姓名 '
          f'({len(mapped) / len(agg) * 100:.1f}%)，${sum(r["金額合計"] for r in mapped):,.0f}')
    for k, v in collections.Counter(r['比對方式'] for r in mapped).most_common():
        print(f'     {k}: {v}')
    print(f'⚠️ 需人工確認 {len(need)} 個姓名，${sum(r["金額合計"] for r in need):,.0f}')
    for k, v in collections.Counter(r['狀態'] for r in manual).most_common():
        amt = sum(r['金額合計'] for r in manual if r['狀態'] == k)
        print(f'     {k}: {v} 人 ${amt:,.0f}')
    print('\n輸出：data/name_map.csv、data/unmatched.csv')


if __name__ == '__main__':
    main()
