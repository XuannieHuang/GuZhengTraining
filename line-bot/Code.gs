/**
 * LINE 語音記帳小幫手 — 階段 2：語音 → 辨識 → 在群組回覆結果（尚未寫入帳本）
 *
 * 主任在 3 人群組傳「語音訊息」，機器人辨識並列出解析結果供確認。
 * 只處理語音訊息，群組裡的文字聊天一律忽略。
 *
 * 設計原則（2026-09 定案）：
 *   1. 不信任語音辨識出來的「字」，只用「音」比對系統名單；顯示的一律是系統正確全名。
 *   2. 人名比對在這支程式裡「確定性」執行，不交給 AI 判斷 —— AI 只負責轉文字與抓金額。
 *   3. 比對範圍是全體學生（含停課），停課的人也可能回來繳費。
 *   4. 對不到人不追問主任，主任不需要知道誰在系統裡。
 *
 * 需要另一個檔案 PinyinMap.gs（用 py tools/gen_pinyin_map.py 產生）。
 *
 * ⚠️ 所有金鑰都放在「專案設定 → 指令碼屬性」，程式碼本身不含任何密鑰。
 *    需要的屬性：LINE_CHANNEL_ACCESS_TOKEN / GEMINI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_KEY
 */

const PROPS = PropertiesService.getScriptProperties();
const LINE_TOKEN = PROPS.getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const GEMINI_KEY = PROPS.getProperty('GEMINI_API_KEY');
const SB_URL     = PROPS.getProperty('SUPABASE_URL');
const SB_KEY     = PROPS.getProperty('SUPABASE_SERVICE_KEY');

const GEMINI_MODEL = 'gemini-2.5-flash';   // 若模型更名，只改這裡

/* ────────────── LINE Webhook 入口 ────────────── */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    (body.events || []).forEach(function (ev) {
      try { handleEvent(ev); } catch (err) { logErr('handleEvent', err); }
    });
  } catch (err) {
    logErr('doPost', err);
  }
  // 一律回 200，避免 LINE 重送
  return ContentService.createTextOutput('OK');
}

function handleEvent(ev) {
  // 只處理「語音訊息」；文字聊天直接忽略（天然過濾，不需關鍵字）
  if (ev.type !== 'message' || !ev.message || ev.message.type !== 'audio') return;

  // 防重送：LINE 逾時會重發同一則，用 messageId 擋掉
  if (seenBefore(ev.message.id)) return;

  const audio = getLineAudio(ev.message.id);
  if (!audio) { reply(ev.replyToken, '⚠️ 音檔下載失敗，請再說一次'); return; }

  const parsed = transcribeAndParse(audio);
  if (parsed.錯誤) { reply(ev.replyToken, '⚠️ ' + parsed.錯誤 + '，請再說一次'); return; }

  const idx = buildIndex(buildPeople(fetchStudents(), fetchRentals()));
  (parsed.筆數 || []).forEach(function (it) {
    it.比對 = matchPerson(it.對象, it.對象拼音, idx);
  });
  reply(ev.replyToken, formatResult(parsed));
}

/* ────────────── LINE API ────────────── */
function getLineAudio(messageId) {
  const res = UrlFetchApp.fetch(
    'https://api-data.line.me/v2/bot/message/' + messageId + '/content',
    { headers: { Authorization: 'Bearer ' + LINE_TOKEN }, muteHttpExceptions: true }
  );
  if (res.getResponseCode() !== 200) { logErr('getLineAudio', res.getContentText()); return null; }
  return res.getBlob();
}

function reply(replyToken, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + LINE_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] }),
    muteHttpExceptions: true
  });
}

/* ────────────── Supabase：取全體學生（含停課，停課者也會回來繳費） ────────────── */
function fetchStudents() {
  if (!SB_URL || !SB_KEY) return [];
  const url = SB_URL + '/rest/v1/students'
            + '?select=id,name,plan,status,attended,last_pay_date,teacher_id';
  const res = UrlFetchApp.fetch(url, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) { logErr('fetchStudents', res.getContentText()); return []; }
  return JSON.parse(res.getContentText());
}

/* ────────────── Supabase：取租借（承租人姓名才是租借的主體，student_id 只是方便欄位） ── */
function fetchRentals() {
  if (!SB_URL || !SB_KEY) return [];
  const url = SB_URL + '/rest/v1/rentals'
            + '?select=id,student_id,renter_name,instrument,billing,pay_date,start_date,due_date,status';
  const res = UrlFetchApp.fetch(url, {
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) { logErr('fetchRentals', res.getContentText()); return []; }
  return JSON.parse(res.getContentText());
}

/* ────────────── Gemini：只負責轉文字＋抓欄位，不做人名判斷 ────────────── */
function transcribeAndParse(blob) {
  const prompt =
    '你是音樂教室的記帳助理。請聽這段中文（台灣）語音，完成兩件事：\n' +
    '1) 逐字轉成文字\n' +
    '2) 解析出記帳資訊\n\n' +
    '規則：\n' +
    '- 金額可能是口語，例如「三千六」=3600、「一萬零八百」=10800、「九千」=9000。\n' +
    '- 類別只能是：學費、租箏、體驗課、樂團、比賽檢定、押金、退費、支出、其他。\n' +
    '- 一句話可能包含多筆，請全部列出。\n' +
    '- 「對象」照你聽到的寫，不要自行更正人名；另外用「對象拼音」給出該人名的漢語拼音\n' +
    '  （小寫、不含聲調、不含空格，例如「林依辰」→「linyichen」）。人名比對由程式負責。\n' +
    '- 沒講到的欄位就填 null，不要自行臆測。\n\n' +
    '只回傳 JSON，不要任何其他文字：\n' +
    '{"原文":"完整逐字稿","筆數":[{"對象":"聽到的人名或支出項目","對象拼音":"pinyin",' +
    '"類別":"學費|租箏|體驗課|樂團|比賽檢定|押金|退費|支出|其他",' +
    '"金額":數字或null,"期數":數字或null,"備註":""}]}';

  const payload = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: 'audio/mp4', data: Utilities.base64Encode(blob.getBytes()) } }
      ]
    }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' }
  };

  const res = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent?key=' + GEMINI_KEY,
    { method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }
  );

  if (res.getResponseCode() !== 200) {
    logErr('gemini', res.getContentText());
    return { 原文: '', 筆數: [], 錯誤: '辨識服務錯誤（' + res.getResponseCode() + '）' };
  }

  try {
    const j = JSON.parse(res.getContentText());
    return JSON.parse(j.candidates[0].content.parts[0].text);
  } catch (err) {
    logErr('parseGemini', err + ' | ' + res.getContentText());
    return { 原文: '', 筆數: [], 錯誤: '解析失敗' };
  }
}

/* ────────────── 人名比對（確定性，不靠 AI） ────────────── */
/**
 * 把「學生」與「承租人」合併成同一組可比對的人。
 * 租借的主體是 renter_name（student_id 只是存檔時剛好同名就順手連的方便欄位），
 * 所以只租箏沒上課、或已停課只剩租箏的人，一樣要比對得到。
 */
function buildPeople(students, rentals) {
  const by = {};
  function get(name) {
    const k = (name || '').replace(/[\s　]/g, '');
    if (!k) return null;
    if (!by[k]) by[k] = { name: name, key: k, students: [], rentals: [] };
    return by[k];
  }
  (students || []).forEach(function (s) { const p = get(s.name); if (p) p.students.push(s); });
  (rentals || []).forEach(function (r) { const p = get(r.renter_name); if (p) p.rentals.push(r); });
  return Object.keys(by).map(function (k) { return by[k]; });
}

function buildIndex(people) {
  const byName = {}, byPinyin = {}, byGiven = {}, byChar = {};
  function push(map, key, p) { if (key) { (map[key] = map[key] || []).push(p); } }

  people.forEach(function (p) {
    const n = p.key;
    push(byName, n, p);
    push(byPinyin, toPinyin(n), p);
    if (n.length >= 2) {
      push(byGiven, toPinyin(n.slice(1)), p);          // 去掉姓的拼音
      const seen = {};
      for (var i = 1; i < n.length; i++) {             // 名字裡每個字的音（疊字暱稱用）
        var cp = pinyinOf(n[i]);
        if (cp && !seen[cp]) { seen[cp] = 1; push(byChar, cp, p); }
      }
    }
  });
  return { byName: byName, byPinyin: byPinyin, byGiven: byGiven, byChar: byChar };
}

/** 人的顯示狀態：優先用學生狀態，沒有學生資料就標「只有租箏」 */
function personLabel(p) {
  const s = bestStudent(p);
  if (s) return (s.status || '') + (s.plan ? '·' + s.plan : '');
  return p.rentals.length ? '只有租箏' : '';
}

function bestStudent(p) { return tidy(p.students)[0] || null; }
function activeRental(p) {
  const live = p.rentals.filter(function (r) { return r.status === '租賃中'; });
  return live.length === 1 ? live[0] : null;     // 剛好一筆才自動處理
}

const STATUS_RANK = { '在學': 0, '新生': 1, '停課': 2, '退學': 3 };

/** 去重（同名多筆只留一個）並排序：在學/新生優先，其次繳費日新的優先 */
function tidy(list) {
  const best = {};
  (list || []).forEach(function (s) {
    const k = s.name || s.key;
    const prev = best[k];
    if (!prev || rankOf(s) < rankOf(prev)) best[k] = s;
  });
  return Object.keys(best).map(function (k) { return best[k]; })
    .sort(function (a, b) { return rankOf(a) - rankOf(b); });
}

/** person 用它最好的那筆學生資料排序；沒有學生資料的（只租箏）排最後 */
function rankOf(x) { return x.students ? (bestStudent(x) ? rank(bestStudent(x)) : 8e9) : rank(x); }

function rank(s) {
  const st = STATUS_RANK[s.status] === undefined ? 9 : STATUS_RANK[s.status];
  const d = s.last_pay_date ? Number(String(s.last_pay_date).replace(/-/g, '')) : 0;
  return st * 1e9 - d;          // 狀態優先，同狀態再比繳費日
}

/**
 * 比對層級：姓名完全相同 → 全名同音 → 疊字暱稱 → 只講名補姓氏
 * 回傳 { how, hit, cands }；hit 有值代表唯一命中可直接採用，cands 有值代表要主任點選。
 */
function matchPerson(spoken, spokenPy, idx) {
  const n = (spoken || '').replace(/[\s　]/g, '');
  if (!n) return { how: '無', cands: [] };

  // L1 姓名完全相同
  var c = tidy(idx.byName[n]);
  if (c.length === 1) return { how: '姓名相同', hit: c[0], cands: [] };
  if (c.length > 1)   return { how: '系統有同名多人', cands: c };

  // 拼音兩個來源都試：自己算的（精準，但生僻字查不到）＋ Gemini 給的（一定有，但可能有誤）
  const pys = [toPinyin(n), String(spokenPy || '').toLowerCase().replace(/[^a-z]/g, '')]
    .filter(function (x, i, a) { return x && a.indexOf(x) === i; });

  // L2 全名同音（辨識成依辰/依晨/怡辰都會走到這裡）
  for (var k = 0; k < pys.length; k++) {
    c = tidy(idx.byPinyin[pys[k]]);
    if (c.length === 1) return { how: '同音', hit: c[0], cands: [] };
    if (c.length > 1)   return { how: '同音·多人', cands: c };
  }
  const py = pys[0] || '';

  // L3 疊字暱稱（靜靜、瀞瀞）→ 實測 43 個名字音有 26 個會對到多人，一律列候選不自動採用
  if (n.length === 2 && n[0] === n[1]) {
    const cp = pinyinOf(n[0]) || py.slice(0, Math.floor(py.length / 2));
    return { how: '暱稱', cands: tidy(idx.byChar[cp]) };
  }

  // L4 只講名沒講姓
  if (n.length === 2) {
    for (var j = 0; j < pys.length; j++) {
      c = tidy(idx.byGiven[pys[j]]);
      if (c.length === 1) return { how: '補姓氏', hit: c[0], cands: [] };
      if (c.length > 1)   return { how: '補姓氏·多人', cands: c };
    }
  }

  return { how: '查無', cands: [] };
}

/* ────────────── 組回覆訊息 ────────────── */
const NON_PERSON = { 支出: 1, 其他: 1, 樂團: 1, 比賽檢定: 1 };

function formatResult(r) {
  const items = r.筆數 || [];
  var msg = '🎙 我聽到\n「' + (r.原文 || '（聽不清楚）') + '」\n';
  if (!items.length) return msg + '\n找不到可記帳的內容，請再說一次。';

  msg += '\n共 ' + items.length + ' 筆：';

  items.forEach(function (it, i) {
    const amt = it.金額 == null ? '未提及' : ('$' + Number(it.金額).toLocaleString());
    const m = it.比對 || { how: '無', cands: [] };
    msg += '\n\n' + (i + 1) + '. ' + (it.類別 || '—') + '　' + amt
         + (it.期數 ? '　' + it.期數 + ' 期' : '');

    if (NON_PERSON[it.類別]) {
      msg += '\n　' + (it.對象 || '—') + '（不需對到學生）';
      return;
    }
    if (m.hit) {
      msg += '\n　✅ ' + m.hit.name + '　' + personLabel(m.hit)
           + (m.how === '姓名相同' ? '' : '　（' + m.how + '）')
           + detailFor(it, m.hit);
      return;
    }
    if (m.cands && m.cands.length) {
      msg += '\n　⚠️ 「' + it.對象 + '」有 ' + m.cands.length + ' 位可能（' + m.how + '）';
      m.cands.slice(0, 6).forEach(function (p, k) {
        msg += '\n　　' + (k + 1) + '） ' + p.name + '　' + personLabel(p);
      });
      return;
    }
    msg += '\n　⚠️ 「' + it.對象 + '」系統查無此人 → 只會記帳，不進系統';
  });

  return msg + '\n\n※ 測試階段：目前只辨識，尚未寫入帳本。';
}

/** 依類別補上該看的細節：學費看學生資料，租箏看租約 */
function detailFor(it, p) {
  if (it.類別 === '租箏') {
    const r = activeRental(p);
    if (r) return '\n　　租約到期 ' + (r.due_date || '—') + '（' + (r.billing || '') + '）';
    return p.rentals.length
      ? '\n　　⚠️ 有 ' + p.rentals.length + ' 筆租約，無法判斷續哪一筆 → 只記帳'
      : '\n　　⚠️ 系統沒有租約 → 只記帳';
  }
  if (it.類別 === '押金') return '\n　　押金不延長租期';
  const s = bestStudent(p);
  if (!s) return '\n　　⚠️ 系統沒有學生資料（只有租箏） → 只記帳';
  return '\n　　已上 ' + (s.attended == null ? '—' : s.attended) + ' 堂';
}

/* ────────────── 小工具 ────────────── */
function seenBefore(messageId) {
  const cache = CacheService.getScriptCache();
  const key = 'msg_' + messageId;
  if (cache.get(key)) return true;
  cache.put(key, '1', 600);   // 10 分鐘內同一則不重複處理
  return false;
}

function logErr(where, err) {
  console.error('[' + where + '] ' + err);
}

/* ────────────── 設定檢查（部署前先在編輯器執行一次） ────────────── */
function checkSetup() {
  const need = ['LINE_CHANNEL_ACCESS_TOKEN', 'GEMINI_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
  const missing = need.filter(function (k) { return !PROPS.getProperty(k); });
  if (missing.length) { console.log('❌ 缺少指令碼屬性：' + missing.join('、')); return; }

  const students = fetchStudents();
  console.log('✅ 屬性齊全；讀到學生 ' + students.length + ' 位（含停課）');
  if (!students.length) { console.log('❌ 讀不到學生，請檢查 SUPABASE_URL / SERVICE_KEY'); return; }

  // 順便驗證拼音表覆蓋率
  var miss = students.filter(function (s) { return !toPinyin((s.name || '').replace(/\s/g, '')); });
  if (miss.length) {
    console.log('⚠️ 有 ' + miss.length + ' 位學生的字不在拼音表裡：'
                + miss.slice(0, 10).map(function (s) { return s.name; }).join('、'));
    console.log('   請重跑 py tools/gen_pinyin_map.py 並把 PinyinMap.gs 貼回來');
  } else {
    console.log('✅ 拼音表覆蓋全部學生姓名');
  }

  // 比對自我測試
  const idx = buildIndex(students);
  ['林依辰', '依辰', '靜靜'].forEach(function (t) {
    const m = matchStudent(t, '', idx);
    console.log('  測試「' + t + '」→ ' + m.how + '：'
                + (m.hit ? m.hit.name : (m.cands || []).map(function (s) { return s.name; }).join('、') || '無'));
  });
}
