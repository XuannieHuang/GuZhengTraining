# -*- coding: utf-8 -*-
"""本機預覽伺服器：跟 Python 內建 http.server 一樣，但強制不快取。

內建的 http.server 不送 Cache-Control，瀏覽器會自己決定快取，
導致改完程式重新整理還是看到舊版（線上有 prototype/_headers 所以不會這樣）。
這支只多做一件事：每個回應都加 no-store。

    py tools/devserver.py [port] [directory]
"""
import sys, os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
ROOT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'prototype')


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):          # 只印錯誤，不要每個檔案都洗版
        if not str(args[1] if len(args) > 1 else '').startswith('2'):
            super().log_message(fmt, *args)


if __name__ == '__main__':
    os.chdir(ROOT)
    print(f'預覽伺服器 http://localhost:{PORT}  →  {ROOT}  （已關閉快取）')
    ThreadingHTTPServer(('', PORT), NoCacheHandler).serve_forever()
