/* mock.js — 操作手冊截圖用的假資料
 *
 * ⚠️ 姓名全部是虛構的。這個 repo 是公開的，絕不可放真實學生姓名。
 *
 * 網址參數：
 *   ?v=todo|check|rental|report|events|setting   要顯示哪一頁
 *   ?m=pay|student|newstudent|rental|newrental   要順便打開哪個彈窗
 *   ?act=<動作>                                   截圖前要模擬的操作（見 ACTIONS）
 *   ?cal=選擇器;選擇器;...                        在這些元素上畫紅框與編號 ➊➋➌
 */
(function () {
  const q = new URLSearchParams(location.search);
  /* 假資料的「今天」釘死在這一天。
     用真的 new Date() 的話，每過一天所有相對日期都會跟著移動 ——
     手冊截圖隔幾天重拍就全部不一樣，也沒辦法拿前後兩次比對來確認版面有沒有被改到。 */
  const NOW = new Date('2026-11-24T00:00:00');
  // 用本地年月日組字串。toISOString() 會先轉成 UTC，
  // UTC+8 的午夜在 UTC 是前一天，整組假日期會少一天。
  const T = (n) => {
    const d = new Date(NOW); d.setDate(d.getDate() + n);
    const p = (x) => String(x).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  const TEACHERS = [
    { id: 't1', name: '王美華', role: ' 主任', inst: ['古箏'], sort: 1, active: true },
    { id: 't2', name: '李佳蓉', role: '', inst: ['古箏', '琵琶'], sort: 2, active: true },
    { id: 't3', name: '張淑芬', role: '', inst: ['古箏'], sort: 3, active: true },
  ];

  const S = (id, t, name, plan, attended, status, extra) => Object.assign({
    id, t, name, inst: '古箏', type: '個人', plan, attended, status,
    pay: T(-40), amt: plan === '季繳' ? 10000 : 3500,
    contact: '', partner: null, note: '', checked: false, notified: false, deleted: false,
    stopped: null,
  }, extra || {});

  const STUDENTS = [
    S('s1', 't1', '陳品妍', '季繳', 11, '在學', { note: '週三 19:00', pay: T(-88) }),
    S('s2', 't1', '林孟儒', '季繳', 12, '在學', { pay: T(-92) }),
    S('s3', 't1', '黃湘瑜', '月繳', 3, '在學', { plan: '月繳', amt: 3500, pay: T(-31) }),
    S('s4', 't1', '吳子晴', '季繳', 4, '在學', {}),
    S('s5', 't1', '蔡宜臻', '季繳', 0, '新生', { attended: 0, pay: T(-3) }),
    S('s6', 't2', '周耘誠', '季繳', 11, '在學', { note: '要換老師' }),
    S('s7', 't2', '許家瑋', '月繳', 2, '在學', { plan: '月繳', amt: 3500 }),
    S('s8', 't2', '鄭又寧', '季繳', 6, '在學', { type: '雙人', partner: 's9' }),
    S('s9', 't2', '謝佩璇', '季繳', 6, '在學', { type: '雙人', partner: 's8' }),
    S('s10', 't3', '劉柏睿', '季繳', 8, '在學', {}),
    S('s11', 't3', '楊雅筑', '季繳', 12, '在學', {}),
    S('s12', 't3', '曾冠宇', '季繳', 2, '停課', { pay: T(-200), stopped: T(-3) + 'T02:00:00Z' }),
    // 一位有停課日、一位沒有（舊資料），讓手冊截圖能呈現兩種情況
    S('s13', 't1', '何宜蓁', '季繳', 0, '停課', { pay: T(-150) }),
  ];

  const RENTALS = [
    { id: 'r1', sid: 's1', name: '陳品妍', inst: '古箏', billing: '季繳', pay: T(-95), start: T(-95), due: T(-5), status: '租賃中', returned: null, note: '' },
    { id: 'r2', sid: 's4', name: '吳子晴', inst: '古箏', billing: '季繳', pay: T(-80), start: T(-80), due: T(10), status: '租賃中', returned: null, note: '' },
    { id: 'r3', sid: 's8', name: '鄭又寧', inst: '古箏', billing: '季繳', pay: T(-20), start: T(-20), due: T(70), status: '租賃中', returned: null, note: '' },
    { id: 'r4', sid: null, name: '何靜美', inst: '古箏', billing: '季繳', pay: T(-40), start: T(-40), due: T(50), status: '租賃中', returned: null, note: '只租箏沒上課' },
    { id: 'r5', sid: 's11', name: '楊雅筑', inst: '琵琶', billing: '月繳', pay: T(-60), start: T(-60), due: T(-30), status: '已還箏', returned: T(-28), note: '' },
  ];

  const BOOKS = [
    { id: 'b1', name: '範例教本 一', price: 350, qty: 12, sort: 1, photo: '', note: '', active: true, deleted: false },
    { id: 'b2', name: '範例教本 二', price: 350, qty: 8,  sort: 2, photo: '', note: '缺貨中', active: true, deleted: false },
    { id: 'b3', name: '範例教本 三', price: 380, qty: 6,  sort: 3, photo: '', note: '', active: true, deleted: false },
    { id: 'b4', name: '範例入門',   price: 420, qty: 5,  sort: 4, photo: '', note: '', active: true, deleted: false },
    { id: 'b5', name: '範例練習簿', price: 180, qty: 0,  sort: 5, photo: '', note: '待補貨', active: true, deleted: false },
  ];

  const PLAN_ROWS = [
    { id: 'p1', instrument: '古箏', class_type: '個人', billing: '季繳', sessions: 12, price: 10000 },
    { id: 'p2', instrument: '古箏', class_type: '個人', billing: '月繳', sessions: 4, price: 3500 },
    { id: 'p3', instrument: '古箏', class_type: '雙人', billing: '季繳', sessions: 12, price: 7200 },
    { id: 'p4', instrument: '琵琶', class_type: '個人', billing: '月繳', sessions: 4, price: 4000 },
  ];

  const PAYMENTS = [
    { id: 'pay1', student_id: 's5', billing: '季繳', periods: 1, amount: 10000, pay_date: T(-3) },
    { id: 'pay2', student_id: 's4', billing: '季繳', periods: 1, amount: 10000, pay_date: T(-12) },
    { id: 'pay3', student_id: 's7', billing: '月繳', periods: 2, amount: 3500, pay_date: T(-18) },
  ];

  /* 截圖前要模擬的操作 */
  const ACTIONS = {
    // 核對頁：示範改過堂數會打勾變綠、自動下移
    checked: () => { DB.students.find(s => s.id === 's4').checked = true; },
    // 核對頁：把搜尋框展開
    search: () => { ui.searchOpen = true; ui.search = '雅'; },
    // 租借彈窗：示範承租人建議清單
    suggest: () => {
      openRental(null);
      const i = document.querySelector('#rov .ttl-inp');
      i.value = '楊'; renterInput('楊');
    },
    // 租借彈窗：示範非學生承租人
    nonstudent: () => {
      openRental(null);
      const i = document.querySelector('#rov .ttl-inp');
      i.value = '何靜美'; renterInput('何靜美');
    },
    // 新增學生：把「一併登記首期繳費」打開
    firstpay: () => { openStudent(null); ui.smodal.name = '蔡宜臻'; ui.smodal.payOn = true; renderStudentModal(); },
    // 編輯學生：把收合的「記一筆繳費」展開（看展開後的排版）
    payon: () => { openStudent('s1'); ui.smodal.payOn = true; renderStudentModal(); },
    // 桌機分頁式面板：切到「記繳費」／「紀錄」那一頁
    paypane: () => { openStudent('s1'); if (typeof sPane === 'function') setTimeout(() => sPane('pay'), 300); },
    logpane: () => { openStudent('s1'); if (typeof sPane === 'function') setTimeout(() => sPane('log'), 300); },
    // 課本面板：切到「記一筆進貨」／「紀錄」那一頁
    stockpane: () => { openBook('b2'); if (typeof bPane === 'function') setTimeout(() => bPane('stock'), 300); },
    logpane2:  () => { openBook('b2'); if (typeof bPane === 'function') setTimeout(() => bPane('log'), 300); },
  };

  /* 學生彈窗會去資料庫撈「繳費紀錄」與「老師異動歷史」。
     demo 連不上，結果永遠顯示「尚無紀錄」—— 版面在有資料時會不會爆就測不到。
     這裡把這兩張表攔下來回假資料（只攔 select，不碰其他語法）。 */
  const FAKE = {
    payments: [
      { id: 'h1', student_id: 's1', billing: '季繳', periods: 1, amount: 10000, pay_date: T(-88) },
      { id: 'h2', student_id: 's1', billing: '季繳', periods: 1, amount: 10000, pay_date: T(-178) },
      { id: 'h3', student_id: 's1', billing: '季繳', periods: 2, amount: 10000, pay_date: T(-268) },
      { id: 'h4', student_id: 's1', billing: '月繳', periods: 1, amount: 3500, pay_date: T(-300) },
      { id: 'h5', student_id: 's1', billing: '月繳', periods: 1, amount: -3500, pay_date: T(-310) },
      { id: 'h6', student_id: 's1', billing: '月繳', periods: 1, amount: 3500, pay_date: T(-340) },
      { id: 'h7', student_id: 's1', billing: '月繳', periods: 1, amount: 3500, pay_date: T(-370) },
    ],
    books: [],          // 寫入用（update/insert），清單本身是 paint() 直接塞的
    book_moves: [
      { id: 'm1', book_id: 'b1', kind: '進貨', move_date: T(-40), qty_before: 0,  qty_after: 12, note: '建檔初始數量' },
      { id: 'm2', book_id: 'b2', kind: '進貨', move_date: T(-40), qty_before: 0,  qty_after: 10, note: '建檔初始數量' },
      { id: 'm3', book_id: 'b2', kind: '盤點', move_date: T(-10), qty_before: 10, qty_after: 8,  note: '' },
    ],
    teacher_changes: [
      { id: 'c1', student_id: 's1', from_teacher_id: 't2', to_teacher_id: 't1', changed_at: T(-200) },
      { id: 'c2', student_id: 's1', from_teacher_id: null, to_teacher_id: 't2', changed_at: T(-400) },
    ],
  };
  (function stubDb() {
    // 只給桌機預覽頁（docs/rwd/demo.html）用。
    // 手冊的示範頁不能吃這份假紀錄 —— 它一吃，手冊截圖就跟著變了。
    if (!/\/rwd\//.test(location.pathname)) return;
    if (typeof sb === 'undefined' || !sb.from) return;
    const real = sb.from.bind(sb);
    sb.from = (table) => {
      if (!(table in FAKE)) return real(table);
      let rows = FAKE[table].slice();
      const api = {
        select: () => api,
        eq: (c, v) => { rows = rows.filter(r => r[c] === v); return api; },
        gt: (c, v) => { rows = rows.filter(r => r[c] > v); return api; },
        order: () => api,
        limit: (n) => { rows = rows.slice(0, n); return api; },
        insert: () => api, update: () => api, delete: () => api,
        then: (res, rej) => Promise.resolve({ data: rows, error: null }).then(res, rej),
      };
      return api;
    };
  })();

  function paint() {
    DB.teachers = TEACHERS.map(t => Object.assign({}, t));
    DB.students = STUDENTS.map(s => Object.assign({}, s));
    DB.rentals = RENTALS.map(r => Object.assign({}, r));
    DB.books = BOOKS.map(b => Object.assign({}, b));
    PLANS = PLAN_ROWS;
    PLAN_PRICE['季繳'] = 10000; PLAN_PRICE['月繳'] = 3500;
    ME = '管'; MY_EMAIL = 'demo@example.com';
    REPORTS = { payments: PAYMENTS, month: T(0).slice(0, 7), lastCount: T(-10) };

    ui.screen = q.get('v') || 'todo';
    if (ui.screen === 'stocktake' && typeof openStocktake === 'function') { openStocktake(); return; }
    ui.tab = q.get('t') || 't1';
    ui.search = ''; ui.searchOpen = false; ui.modal = null; ui.smodal = null; ui.rmodal = null;
    render();

    const m = q.get('m');
    if (m === 'pay') openPay('s1');
    if (m === 'student') openStudent('s1');
    if (m === 'newstudent') openStudent(null);
    if (m === 'rental') openRental('r1');
    if (m === 'newrental') openRental(null);
    if (m === 'newplan') openPlan(null);
    if (m === 'book') openBook('b2');
    if (m === 'newbook') openBook(null);

    const act = q.get('act');
    if (act && ACTIONS[act]) { ACTIONS[act](); if (!m && !/suggest|nonstudent|firstpay|pane/.test(act)) render(); }

    drawCallouts(q.get('cal'));
    watchLayout();
    document.documentElement.dataset.ready = '1';   // 截圖腳本等這個旗標
  }

  /* 在指定元素上畫紅框與編號，讓截圖直接帶「點這裡」的標註。
     位置必須在版面「穩定之後」才量：網頁字體是非同步載入的，到位前後高度會變；
     而無頭 Chrome 的 --virtual-time-budget 會讓 setTimeout 幾乎立刻觸發，
     所以不能靠延遲，改成用 ResizeObserver 一有變動就重畫。 */
  let calSpec = null;

  function drawCallouts(spec) {
    if (spec !== undefined) calSpec = spec;
    document.querySelectorAll('.cal-ring,.cal-num').forEach(n => n.remove());
    if (!calSpec) return;
    calSpec.split(';').forEach((sel, i) => {
      sel = sel.trim(); if (!sel) return;
      const el = document.querySelector(sel);
      if (!el) { console.warn('標註找不到元素：' + sel); return; }
      const r = el.getBoundingClientRect();
      const x = r.left + scrollX, y = r.top + scrollY;
      const ring = document.createElement('div');
      ring.className = 'cal-ring';
      ring.style.cssText = `left:${x - 3}px; top:${y - 3}px; width:${r.width + 6}px; height:${r.height + 6}px;`;
      const num = document.createElement('div');
      num.className = 'cal-num'; num.textContent = i + 1;
      num.style.cssText = `left:${x - 16}px; top:${y - 14}px;`;
      document.body.append(ring, num);
    });
  }

  /* 只要畫面內容的尺寸變了（字體載入、彈窗重繪…）就重畫標註。
     觀察 #app 與彈窗容器而不是 body —— 標註本身是絕對定位，不會觸發它們變動。 */
  const ro = new ResizeObserver(() => drawCallouts());
  function watchLayout() {
    ro.disconnect();
    ['#app', '#ov', '#sov', '#rov'].forEach(sel => {
      const el = document.querySelector(sel);
      if (el) ro.observe(el);
    });
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => drawCallouts()).catch(() => {});
  }

  // boot() 是非同步的，可能在我們之後才把畫面蓋掉 → 畫兩次
  paint();
  setTimeout(paint, 900);
})();
