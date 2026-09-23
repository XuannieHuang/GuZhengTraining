# -*- coding: utf-8 -*-
"""產生 Apps Script 用的「漢字→拼音」對照表 → line-bot/PinyinMap.gs

Apps Script 沒有拼音函式庫，所以在這邊先算好、內嵌進去。

涵蓋 CJK 基本區全部有拼音的字（約 20,900 個），不只系統現有學生姓名——
因為語音辨識錯字常常會冒出名單裡沒有的字（例：林依辰 聽成 林依「晨」，
而「晨」不在任何學生姓名裡）。全覆蓋才能純靠拼音比對，不必仰賴 AI 給拼音。

存成「拼音:該音所有字」的壓縮格式，63 KB；每個字只出現一次，
用的是 pypinyin 對該字的首選讀音，所以多音字不會產生歧義。

    py tools/gen_pinyin_map.py
"""
import os, sys, io, datetime, collections

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pypinyin import lazy_pinyin

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'line-bot', 'PinyinMap.gs')


def main():
    groups = collections.defaultdict(list)
    n = 0
    for cp in range(0x4E00, 0xA000):
        ch = chr(cp)
        p = lazy_pinyin(ch)
        if p and p[0] and p[0] != ch and p[0].isascii():
            groups[p[0]].append(ch)
            n += 1

    lines = [f"'{p}:{''.join(cs)}'," for p, cs in sorted(groups.items())]
    body = '\n'.join(lines).rstrip(',')

    js = f"""/**
 * 漢字 → 拼音對照表（自動產生，請勿手改）
 *
 * 產生方式： py tools/gen_pinyin_map.py
 * 產生時間： {datetime.datetime.now():%Y-%m-%d %H:%M}
 * 涵蓋範圍： CJK 基本區 {n:,} 個字、{len(groups)} 個音
 *
 * 格式是「拼音:該音的所有字」，每個字只出現一次（pypinyin 的首選讀音），
 * 第一次呼叫 toPinyin() 時才展開成查表用的物件。
 */
const PINYIN_PACKED = [
{body}
].join('\\n');

var _PY = null;

/** 單字查拼音；查不到回空字串 */
function pinyinOf(ch) {{
  if (!_PY) {{
    _PY = {{}};
    PINYIN_PACKED.split('\\n').forEach(function (line) {{
      var i = line.indexOf(':');
      var p = line.slice(0, i), cs = line.slice(i + 1);
      for (var k = 0; k < cs.length; k++) _PY[cs[k]] = p;
    }});
  }}
  return _PY[ch] || '';
}}

/** 把姓名轉成拼音字串；有任何一個字查不到就回空字串（代表不可靠，不做拼音比對） */
function toPinyin(name) {{
  var out = '';
  for (var i = 0; i < name.length; i++) {{
    var p = pinyinOf(name[i]);
    if (!p) return '';
    out += p;
  }}
  return out;
}}
"""
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    io.open(OUT, 'w', encoding='utf-8').write(js)
    print(f'✅ 已產生 {OUT}')
    print(f'   {n:,} 個字、{len(groups)} 個音，{os.path.getsize(OUT) / 1024:.0f} KB')


if __name__ == '__main__':
    main()
