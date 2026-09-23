# -*- coding: utf-8 -*-
"""產生操作手冊用的截圖 → docs/手冊/圖/

流程：
  1. 在 5501 起一個根目錄的靜態伺服器（不快取）
  2. 用無頭 Chrome 逐一開 docs/手冊/demo.html?... 截圖
  3. 關掉伺服器

畫面資料全部來自 docs/手冊/mock.js（虛構姓名），不會連到正式資料庫。

    py tools/shoot_manual.py
"""
import os, sys, time, subprocess, shutil, urllib.request, urllib.error
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', '手冊', '圖')
PORT = 5501
SHOT_W = 500        # 無頭 Chrome 在 Windows 的視窗最小寬度就是 500，比這小會被忽略
DSF = 2             # 2 倍解析度，文件裡看得清楚
BASE = f'http://localhost:{PORT}/docs/%E6%89%8B%E5%86%8A/demo.html'

CHROME_CANDIDATES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    shutil.which('chrome') or '', shutil.which('msedge') or '',
]

# (檔名, 查詢字串, 寬, 高)
#   cal= 用 CSS 選擇器指定要畫紅框與編號的元素，分號分隔，順序就是 ➊➋➌
SHOTS = [
    ('01-登入', 'v=login&cal=.btn.google', 390, 700),
    ('02-待辦', 'v=todo&cal=.dtable tbody tr:nth-child(2);.addstu', 390, 780),
    ('03-記繳費', 'v=todo&m=pay&cal=%23ov .chips;%23ov .inp;%23ov .btn.primary', 390, 900),
    ('04-核對', 'v=check&cal=.srch-ic;.tabs .tab:nth-child(2);.srow .num;.chk-add', 390, 800),
    ('05-核對-已核對', 'v=check&act=checked&cal=.chk-card.done', 390, 800),
    ('06-核對-搜尋', 'v=check&act=search&cal=.searchbox2', 390, 700),
    ('07-新增學生', 'v=check&m=newstudent&act=firstpay&cal=.paytoggle;%23sov .btn.primary', 390, 1250),
    ('08-編輯學生', 'v=check&m=student&cal=.sheet-x;.btn-del', 390, 1500),
    ('09-租借', 'v=rental&cal=.rtab:nth-child(1);.raddmini', 390, 800),
    ('10-租借-建議', 'v=rental&m=newrental&act=suggest&cal=%23rov .inp;.rsug-i', 390, 940),
    ('11-租借-非學生', 'v=rental&m=newrental&act=nonstudent&cal=.rlink.warn', 390, 940),
    ('12-租借-內頁', 'v=rental&m=rental&cal=.renew-btn;.resetlink.danger', 390, 1250),
    ('13-報表', 'v=report', 390, 1150),
    ('14-事件修正', 'v=events', 390, 820),
    ('15-設定', 'v=setting', 390, 820),
]


def is_blank(path):
    """判斷截圖是不是整片空白（無頭 Chrome 偶爾會這樣）"""
    if not os.path.exists(path) or os.path.getsize(path) < 3000:
        return True
    im = Image.open(path).convert('L')
    small = im.resize((im.width // 4 or 1, im.height // 4 or 1))
    px = list(small.getdata()) if not hasattr(small, chr(103)+chr(101)+chr(116)+chr(95)+chr(102)+chr(108)+chr(97)+chr(116)+chr(116)+chr(101)+chr(110)+chr(101)+chr(100)+chr(95)+chr(100)+chr(97)+chr(116)+chr(97)) else list(small.get_flattened_data())
    inked = sum(1 for v in px if v < 245)
    return inked < len(px) * 0.02          # 有色像素不到 2% 就當作空白


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
            for attempt in range(3):                      # 無頭 Chrome 偶爾會截到空白，重試
                subprocess.run([
                    chrome, '--headless', '--disable-gpu', '--hide-scrollbars',
                    f'--force-device-scale-factor={DSF}',
                    f'--window-size={SHOT_W},{h}',
                    '--virtual-time-budget=6000',         # 等字體、重繪跑完
                    f'--screenshot={path}', f'{BASE}?{qs}',
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=90)
                if not is_blank(path):
                    ok = True
                    break
            if ok:
                im = Image.open(path)                     # 裁掉手機寬度以外的空白
                im.crop((0, 0, min(w * DSF, im.width), im.height)).save(path)
            size = os.path.getsize(path) if os.path.exists(path) else 0
            print(f'  {"✅" if ok else "❌"} {name:<16}{size/1024:>7.0f} KB')
    finally:
        server.terminate()

    total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith('.png'))
    print(f'\n共 {len(SHOTS)} 張，合計 {total/1024/1024:.1f} MB → docs/手冊/圖/')


if __name__ == '__main__':
    main()
