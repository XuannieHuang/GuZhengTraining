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
  const T = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  const TEACHERS = [
    { id: 't1', name: '王美華', role: ' 主任', inst: ['古箏'], sort: 1, active: true },
    { id: 't2', name: '李佳蓉', role: '', inst: ['古箏', '琵琶'], sort: 2, active: true },
    { id: 't3', name: '張淑芬', role: '', inst: ['古箏'], sort: 3, active: true },
  ];

  const S = (id, t, name, plan, attended, status, extra) => Object.assign({
    id, t, name, inst: '古箏', type: '個人', plan, attended, status,
    pay: T(-40), amt: plan === '季繳' ? 10000 : 3500,
    contact: '', partner: null, note: '', checked: false, notified: false, deleted: false,
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
    S('s12', 't3', '曾冠宇', '季繳', 2, '停課', { pay: T(-200) }),
  ];

  const RENTALS = [
    { id: 'r1', sid: 's1', name: '陳品妍', inst: '古箏', billing: '季繳', pay: T(-95), start: T(-95), due: T(-5), status: '租賃中', returned: null, note: '' },
    { id: 'r2', sid: 's4', name: '吳子晴', inst: '古箏', billing: '季繳', pay: T(-80), start: T(-80), due: T(10), status: '租賃中', returned: null, note: '' },
    { id: 'r3', sid: 's8', name: '鄭又寧', inst: '古箏', billing: '季繳', pay: T(-20), start: T(-20), due: T(70), status: '租賃中', returned: null, note: '' },
    { id: 'r4', sid: null, name: '何靜美', inst: '古箏', billing: '季繳', pay: T(-40), start: T(-40), due: T(50), status: '租賃中', returned: null, note: '只租箏沒上課' },
    { id: 'r5', sid: 's11', name: '楊雅筑', inst: '琵琶', billing: '月繳', pay: T(-60), start: T(-60), due: T(-30), status: '已還箏', returned: T(-28), note: '' },
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
      const i = document.querySelector('#rov .inp');
      i.value = '楊'; renterInput('楊');
    },
    // 租借彈窗：示範非學生承租人
    nonstudent: () => {
      openRental(null);
      const i = document.querySelector('#rov .inp');
      i.value = '何靜美'; renterInput('何靜美');
    },
    // 新增學生：把「一併登記首期繳費」打開
    firstpay: () => { openStudent(null); ui.smodal.name = '蔡宜臻'; ui.smodal.payOn = true; renderStudentModal(); },
  };

  function paint() {
    DB.teachers = TEACHERS.map(t => Object.assign({}, t));
    DB.students = STUDENTS.map(s => Object.assign({}, s));
    DB.rentals = RENTALS.map(r => Object.assign({}, r));
    PLANS = PLAN_ROWS;
    PLAN_PRICE['季繳'] = 10000; PLAN_PRICE['月繳'] = 3500;
    ME = '管'; MY_EMAIL = 'demo@example.com';
    REPORTS = { payments: PAYMENTS, month: new Date().toISOString().slice(0, 7) };

    ui.screen = q.get('v') || 'todo';
    ui.tab = q.get('t') || 't1';
    ui.search = ''; ui.searchOpen = false; ui.modal = null; ui.smodal = null; ui.rmodal = null;
    render();

    const m = q.get('m');
    if (m === 'pay') openPay('s1');
    if (m === 'student') openStudent('s1');
    if (m === 'newstudent') openStudent(null);
    if (m === 'rental') openRental('r1');
    if (m === 'newrental') openRental(null);

    const act = q.get('act');
    if (act && ACTIONS[act]) { ACTIONS[act](); if (!m && !/suggest|nonstudent|firstpay/.test(act)) render(); }

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
