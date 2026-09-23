# -*- coding: utf-8 -*-
"""唯讀資料庫查詢工具（開發分析用）

安全設計（雙重保險）：
1. 連線層級：psycopg connection.read_only = True → 資料庫端就禁止任何寫入
2. 語法白名單：只允許 SELECT / WITH 開頭，禁止疊加語句與所有異動關鍵字

用法：
    py tools/db_select.py "SELECT * FROM students LIMIT 5"
    from db_select import query; cols, rows = query("SELECT ...")
"""
import os, re, sys, csv, io

try:
    import psycopg
except ImportError:
    sys.exit('請先安裝：py -m pip install "psycopg[binary]"')

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')

# 任何會改動資料或權限的關鍵字一律擋掉
FORBIDDEN = re.compile(
    r'\b(insert|update|delete|drop|alter|truncate|create|replace|grant|revoke|'
    r'copy|call|do|merge|vacuum|analyze|reindex|cluster|comment|listen|notify|'
    r'lock|prepare|execute|discard|refresh|import|security)\b', re.I)


def load_db_urls() -> list:
    """回傳可嘗試的連線字串：直連優先，失敗再用 IPv4 pooler"""
    if not os.path.exists(ENV_PATH):
        sys.exit(f'找不到 {ENV_PATH}')
    env = {}
    for line in io.open(ENV_PATH, encoding='utf-8'):
        line = line.strip()
        if line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip()
    urls = [env[k] for k in ('DB_URL', 'DB_URL_POOLER') if env.get(k)]
    if not urls:
        sys.exit('.env.local 內找不到 DB_URL')
    return urls


def connect():
    """依序嘗試連線；直連走 IPv6，本機沒有 IPv6 時自動退到 pooler"""
    last = None
    for u in load_db_urls():
        try:
            return psycopg.connect(u, connect_timeout=15)
        except Exception as e:
            last = e
    raise last


def guard(sql: str) -> str:
    """SQL 白名單檢查；不合格直接拋錯，絕不送出"""
    s = sql.strip().rstrip(';').strip()
    if ';' in s:
        raise ValueError('❌ 禁止一次送出多個語句（偵測到 ;）')
    if not re.match(r'^(select|with)\b', s, re.I):
        raise ValueError('❌ 只允許 SELECT（或 WITH ... SELECT）查詢')
    hit = FORBIDDEN.search(s)
    if hit:
        raise ValueError(f'❌ 偵測到非查詢關鍵字：{hit.group(0)}')
    return s


def query(sql: str, params=None):
    """執行唯讀查詢，回傳 (欄位名list, 資料rows)"""
    s = guard(sql)
    with connect() as conn:
        conn.read_only = True                     # 資料庫層級唯讀交易
        with conn.cursor() as cur:
            cur.execute(s, params)
            cols = [d.name for d in cur.description]
            return cols, cur.fetchall()


def to_csv(sql: str, path: str, params=None) -> int:
    cols, rows = query(sql, params)
    with io.open(path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(cols)
        w.writerows(rows)
    return len(rows)


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('用法：py tools/db_select.py "SELECT ..."')
    cols, rows = query(sys.argv[1])
    print(' | '.join(cols))
    for r in rows[:100]:
        print(' | '.join('' if v is None else str(v) for v in r))
    print(f'({len(rows)} 筆)')
