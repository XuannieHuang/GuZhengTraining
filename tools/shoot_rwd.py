# -*- coding: utf-8 -*-
"""產生桌機版的截圖 → docs/rwd/圖/

跟 tools/shoot_manual.py 同一套做法（無頭 Chrome ＋ 不快取的本機伺服器），
差別只有三點：
  - 開的是 docs/rwd/demo.html（桌機版預覽，載入真實的 prototype 程式）
  - 寬度是桌機尺寸，不需要裁切（Chrome 的 500px 最小寬度限制碰不到）
  - 1 倍解析度就好，2 倍在 1440 寬會變成 2880px 的巨檔

畫面資料全部來自 docs/手冊/mock.js（虛構姓名），不會連到正式資料庫。
資料夾裡的 00-現況-*.png 是改版「之前」的畫面，手動留著做前後對照，
這支不會覆蓋它們。

    py tools/shoot_rwd.py
"""
import os, sys, time, subprocess, shutil, urllib.request, urllib.error
from PIL import Image

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'rwd', '圖')
PORT = 5502
DSF = 1
BASE = f'http://localhost:{PORT}/docs/rwd/demo.html'

CHROME_CANDIDATES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    shutil.which('chrome') or '', shutil.which('msedge') or '',
]

# (檔名, 查詢字串, 寬, 高)
SHOTS = [
    ('01-學生工作台',       'v=check',                 1440,  900),
    ('02-編輯學生',         'v=check&m=student',       1440,  900),
    ('02b-編輯學生-記繳費',  'v=check&act=paypane',     1440,  900),
    ('02c-編輯學生-紀錄',    'v=check&act=logpane',     1440,  900),
    ('03-記繳費',           'v=check&m=pay',           1440,  900),
    ('04-新增學生',         'v=check&m=newstudent',    1440,  980),
    ('05-即將完課',         'v=todo',                  1440,  900),
    ('06-租借',             'v=rental',                1440,  900),
    ('07-租借-內頁',        'v=rental&m=rental',       1440,  900),
    ('08-報表',             'v=report',                1440, 1150),
    ('09-事件修正',         'v=events',                1440,  900),
    ('10-設定',             'v=setting',               1440,  900),
    # ── 改版示意圖（比稿用）──
    ('示意-學生管理-兩欄表單',   'p=a1&v=check&m=student&act=payon', 1440, 900),
    ('示意-學生管理-分頁式',     'p=a2&v=check&m=student',           1440, 900),
    ('示意-設定-左子選單',       'p=b1&v=setting',                   1440, 760),
    ('示意-設定-區段表格',       'p=b2&v=setting',                   1440, 980),

    ('示意-事件修正-表格',   'p=c1&v=events',                    1440, 760),

    ('示意-面板-d1-更多選單',  'p=d1&v=check&m=student',           1440, 720),
    ('示意-面板-d1-記繳費',    'p=d1&v=check&act=paypane',         1440, 720),
    ('示意-面板-d1-紀錄',      'p=d1&v=check&act=logpane',         1440, 720),
    ('示意-面板-d1-租借',      'p=d1&v=rental&m=rental',           1440, 760),
    ('示意-面板-d2-危險操作',  'p=d2&v=check&m=student',           1440, 760),
    ('示意-面板-d1-方案',      'p=d1&v=setting&m=newplan',         1440, 700),

    ('示意-手機-d1-編輯學生', 'p=d1&v=check&m=student',           500, 1180),
    ('示意-手機-d1-新增方案', 'p=d1&v=setting&m=newplan',         500,  820),
    ('示意-手機-d1-租借內頁', 'p=d1&v=rental&m=rental',           500, 1180),
    ('示意-手機-現況-編輯學生','v=check&m=student',           500, 1180),

    ('示意-e1-租借-桌機',    'p=e1&v=rental&m=rental',           1440, 700),
    ('示意-e2-租借-桌機',    'p=e2&v=rental&m=rental',           1440, 700),
    ('示意-e1-學生-桌機',    'p=e1&v=check&m=student',           1440, 700),
    ('示意-e1-學生-紀錄',    'p=e1&v=check&act=logpane',         1440, 700),
    ('示意-e1-租借-手機',    'p=e1&v=rental&m=rental',            500, 1060),
    ('示意-e2-租借-手機',    'p=e2&v=rental&m=rental',            500, 1060),

    ('示意-刪除a-一行框',   'p=f1&v=check&m=student',           1440, 700),
    ('示意-刪除b-文字連結', 'p=f2&v=check&m=student',           1440, 700),
    ('示意-刪除c-按鈕加小字','p=f3&v=check&m=student',          1440, 700),

    ('11-筆電-1280',        'v=check&m=student',       1280,  820),
    ('12-縮放125-1183',      'v=check&m=student',       1183,  820),
    ('13-窄桌機-1024',      'v=check&m=student',       1024,  800),
    ('14-平板-820',         'v=check',                  820, 1000),
    ('15-手機-500',         'v=check',                  500,  820),
]


def is_blank(path):
    if not os.path.exists(path) or os.path.getsize(path) < 3000:
        return True
    im = Image.open(path).convert('L')
    small = im.resize((im.width // 4 or 1, im.height // 4 or 1))
    inked = sum(1 for v in small.getdata() if v < 245)
    return inked < small.width * small.height * 0.02


def find_chrome():
    for p in CHROME_CANDIDATES:
        if p and os.path.exists(p):
            return p
    sys.exit('找不到 Chrome，請自行修改 CHROME_CANDIDATES')


def wait_server(timeout=10):
    for _ in range(timeout * 5):
        try:
            urllib.request.urlopen(f'http://localhost:{PORT}/', timeout=1)
            return True
        except urllib.error.HTTPError:
            return True
        except Exception:
            time.sleep(0.2)
    return False


def main():
    chrome = find_chrome()
    os.makedirs(OUT, exist_ok=True)

    server = subprocess.Popen([sys.executable, os.path.join(ROOT, 'tools', 'devserver.py'),
                               str(PORT), ROOT],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_server():
            sys.exit(f'伺服器沒起來（port {PORT} 可能被佔用）')

        for name, qs, w, h in SHOTS:
            path = os.path.join(OUT, name + '.png')
            ok = False
            for _ in range(3):
                subprocess.run([
                    chrome, '--headless', '--disable-gpu', '--hide-scrollbars',
                    f'--force-device-scale-factor={DSF}',
                    f'--window-size={w},{h}',
                    '--virtual-time-budget=6000',
                    f'--screenshot={path}', f'{BASE}?{qs}',
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
                if not is_blank(path):
                    ok = True
                    break
            size = os.path.getsize(path) if os.path.exists(path) else 0
            print(f'  {"OK " if ok else "BAD"} {name:<18}{size/1024:>7.0f} KB')
    finally:
        server.terminate()

    total = sum(os.path.getsize(os.path.join(OUT, f))
                for f in os.listdir(OUT) if f.endswith('.png'))
    print(f'\n共 {len(SHOTS)} 張，合計 {total/1024/1024:.1f} MB → docs/rwd/圖/')


if __name__ == '__main__':
    main()
