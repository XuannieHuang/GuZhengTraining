# -*- coding: utf-8 -*-
"""確認手機版沒有退步：重拍 15 張手冊截圖，跟 git 版本逐像素比對。

為什麼不直接用 `git status` 看檔案有沒有變：
無頭 Chrome 的算繪不是完全決定性的（字體載入時機、反鋸齒會抖），
同樣的程式連拍兩次就可能有幾十個像素不同。只看「檔案有沒有變」會誤報。
這支改成量化差異：差異像素佔比低於 0.05% 當作算繪雜訊，高於就是真的動到版面。

比對完會把截圖還原成 git 版本，不留下雜訊 diff。

    py tools/check_mobile.py
"""
import os, sys, subprocess, tempfile, shutil
from PIL import Image, ImageChops

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', '手冊', '圖')
NOISE = 0.0005          # 0.05%：低於這個比例當作算繪雜訊
TOL = 8                 # 單一像素的色差容忍值


def main():
    tmp = tempfile.mkdtemp()
    try:
        for f in os.listdir(OUT):
            if f.endswith('.png'):
                shutil.copy(os.path.join(OUT, f), os.path.join(tmp, f))

        print('重拍手冊截圖…')
        subprocess.run([sys.executable, os.path.join(ROOT, 'tools', 'shoot_manual.py')],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        bad = []
        print(f'\n{"檔名":<18}{"差異像素":>10}{"佔比":>9}')
        for f in sorted(os.listdir(OUT)):
            if not f.endswith('.png'):
                continue
            a = Image.open(os.path.join(tmp, f)).convert('RGB')
            b = Image.open(os.path.join(OUT, f)).convert('RGB')
            if a.size != b.size:
                print(f'{f[:-4]:<18}{"尺寸不同":>10}')
                bad.append(f)
                continue
            d = ImageChops.difference(a, b)
            if not d.getbbox():
                continue
            px = [max(p) for p in d.getdata()]
            n = sum(1 for v in px if v > TOL)
            ratio = n / len(px)
            flag = '  ← 版面有變動' if ratio > NOISE else ''
            if ratio > NOISE:
                bad.append(f)
            if n:
                print(f'{f[:-4]:<18}{n:>10}{ratio*100:>8.3f}%{flag}')

        print()
        if bad:
            print(f'⚠ {len(bad)} 張超過雜訊門檻，手機版可能被改到：')
            for f in bad:
                print('   ' + f[:-4])
        else:
            print('✅ 手機版沒有退步（所有差異都在算繪雜訊範圍內）')
    finally:
        subprocess.run(['git', 'checkout', '--', OUT], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        shutil.rmtree(tmp, ignore_errors=True)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
