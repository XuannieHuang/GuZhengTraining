/* mock-proposals.js — 改版示意圖（比稿用，正式程式沒有這一層）
 *
 *   ?p=a1  學生管理 · 兩欄表單
 *   ?p=a2  學生管理 · 分頁式
 *   ?p=b1  設定 · 左子選單＋表格
 *   ?p=b2  設定 · 區段表格
 */
(function () {
  const P = new URLSearchParams(location.search).get('p') || '';
  if (!/^(a1|a2|b1|b2|c1)$/.test(P)) return;
  document.body.dataset.p = P;

  const LABEL = {
    a1: '示意 · 學生管理：兩欄表單',
    a2: '示意 · 學生管理：分頁式',
    b1: '示意 · 設定：左子選單＋表格',
    b2: '示意 · 設定：區段表格',
    c1: '示意 · 事件修正：表格',
  };
  const badge = document.createElement('div');
  badge.className = 'opt-badge';
  badge.textContent = LABEL[P];
  document.body.appendChild(badge);

  /* ── a1：把 .sheet 的欄位分成左右兩組 ─────────────────────
     左＝這個人是誰，右＝這個人的帳。真的要做會寫進 modal-student.js 的樣板。 */
  const RIGHT = ['paybox', 'f-hist', 'f-tchlog'];
  const SKIP = ['handle', 'actions', 'btn-del', 'sub-h', 'resetlink', 'sheet-tabs'];

  function splitTwoCol(sheet) {
    if (!sheet || sheet.querySelector('.col-a')) return;
    const a = document.createElement('div'); a.className = 'col-a';
    const b = document.createElement('div'); b.className = 'col-b';
    Array.prototype.slice.call(sheet.children).forEach(el => {
      if (el.tagName === 'H3' || SKIP.some(c => el.classList.contains(c))) return;
      (RIGHT.some(c => el.classList.contains(c)) ? b : a).appendChild(el);
    });
    const anchor = sheet.querySelector('.btn-del') || sheet.querySelector('.actions');
    sheet.insertBefore(a, anchor); sheet.insertBefore(b, anchor);
  }

  /* ── a2：面板上方三個小頁籤，一次只顯示一組 ───────────────── */
  let pane = 'data';
  window.setSheetPane = function (v) { pane = v; applyPanes(); };

  const PANE_OF = (el) => {
    if (el.classList.contains('paybox')) return 'pay';
    if (el.classList.contains('f-hist') || el.classList.contains('f-tchlog')) return 'log';
    return 'data';
  };

  function applyPanes() {
    const sheet = document.querySelector('#sov .sheet');
    if (!sheet) return;
    let tabs = sheet.querySelector('.sheet-tabs');
    const fields = Array.prototype.slice.call(sheet.children)
      .filter(el => el.classList.contains('field'));
    if (!tabs) {
      tabs = document.createElement('div');
      tabs.className = 'sheet-tabs';
      sheet.insertBefore(tabs, fields[0]);
    }
    const nPay = sheet.querySelector('.paybox') ? 1 : 0;
    const nLog = sheet.querySelectorAll('.f-hist .histrow, .f-tchlog .histrow').length;
    const t = (k, l, n) => `<button class="${pane === k ? 'on' : ''}" onclick="setSheetPane('${k}')">${l}${
      n ? `<span class="n">${n}</span>` : ''}</button>`;
    tabs.innerHTML = t('data', '基本資料', 0) + (nPay ? t('pay', '記繳費', 0) : '') + t('log', '紀錄', nLog);
    fields.forEach(el => el.classList.toggle('pane-hide', PANE_OF(el) !== pane));
  }

  /* ── b1 / b2：設定頁改版 ─────────────────────────────────
     現況是三段卡片列一路往下排。這裡改成表格 ——
     方案的「樂器·類型·繳別·堂數」本來黏成一行，拆成欄位才掃得動。 */
  let setTab = 'plan';
  window.setSetTab = function (v) { setTab = v; render(); };

  function plansTable() {
    const order = (p) => ({ '個人': 0, '團體': 1, '雙人': 2 }[p.class_type] ?? 9) * 10 + (p.billing === '月繳' ? 0 : 1);
    const rows = PLANS.slice().sort((a, b) => (a.instrument + '').localeCompare(b.instrument + '') || order(a) - order(b));
    return `<div class="set-head"><div class="section-title">方案及價格</div>
        <button class="set-addbtn" onclick="openPlan(null)">＋ 新增課程方案</button></div>
      <table class="dtable set-tbl"><thead><tr>
        <th>樂器</th><th>類型</th><th>繳別</th><th class="c">堂數</th><th class="c">價格</th><th></th>
      </tr></thead><tbody>${rows.map(p => `<tr>
        <td class="sname">${p.instrument}</td><td>${p.class_type}</td><td>${p.billing}</td>
        <td class="c">${p.sessions}</td><td class="c price">$${(p.price || 0).toLocaleString()}</td>
        <td class="c"><button class="rowbtn" onclick="openPlan('${p.id}')">編輯</button></td>
      </tr>`).join('')}</tbody></table>`;
  }

  function teachersTable() {
    const list = DB.teachers.slice().sort((a, b) => (b.active ? 1 : 0) - (a.active ? 1 : 0));
    return `<div class="set-head"><div class="section-title">任課老師（在職 ${activeTeachers().length}）</div>
        <button class="set-addbtn" onclick="openTeacher(null)">＋ 新增老師</button></div>
      <table class="dtable set-tbl"><thead><tr>
        <th>姓名</th><th>角色</th><th>教授樂器</th><th class="c">在學學生</th><th class="c">狀態</th><th></th>
      </tr></thead><tbody>${list.map(t => `<tr class="${t.active ? '' : 'inactive'}">
        <td class="sname">${t.name}</td><td>${t.role || '老師'}</td><td>${t.inst.join('、')}</td>
        <td class="c">${DB.students.filter(s => s.t === t.id && isActive(s)).length}</td>
        <td class="c">${t.active ? '在職' : '<span class="badge">已停用</span>'}</td>
        <td class="c"><button class="rowbtn" onclick="openTeacher('${t.id}')">編輯</button>
          <button class="rowbtn ${t.active ? 'off' : ''}" onclick="event.stopPropagation();toggleTeacher('${t.id}')">${t.active ? '停用' : '啟用'}</button></td>
      </tr>`).join('')}</tbody></table>`;
  }

  function allowedTable() {
    const rows = ALLOWED.length ? ALLOWED : [{ email: MY_EMAIL || '—', note: '目前登入中' }];
    return `<div class="set-head"><div class="section-title">管理者白名單${ALLOWED.length ? '（' + ALLOWED.length + '）' : ''}</div>
        <button class="set-addbtn" onclick="addAllowed()">＋ 新增 Email</button></div>
      <table class="dtable set-tbl"><thead><tr><th>Email</th><th>備註</th><th></th></tr></thead><tbody>
      ${rows.map(a => {
        const me = (a.email || '').toLowerCase() === (MY_EMAIL || '').toLowerCase();
        return `<tr><td class="sname">${a.email}</td><td>${me ? '目前登入中' : (a.note || '—')}</td>
          <td class="c">${me ? '<span class="badge pipa">本人</span>'
            : `<button class="rowbtn off" onclick="removeAllowedEmail('${a.email}')">移除</button>`}</td></tr>`;
      }).join('')}</tbody></table>
      ${ALLOWED.length ? '' : '<div class="meta set-note">＊白名單尚未啟用（請先在 Supabase 執行 C1 SQL）。</div>'}`;
  }

  const settingNarrow = window.settingView;
  window.settingView = function () {
    if (!isDesk() || !/^b[12]$/.test(P)) return settingNarrow();
    if (P === 'b2') {
      // 一頁看完，只是把卡片列換成表格
      return `<div class="setpane">${plansTable()}${teachersTable()}${allowedTable()}
        <a class="resetlink" onclick="logout()">登出</a></div>`;
    }
    // b1：左子選單，右邊只顯示選到的那一組
    const n = { plan: PLANS.length, teacher: DB.teachers.length, allowed: ALLOWED.length || 1 };
    const b = (k, l) => `<button class="${setTab === k ? 'on' : ''}" onclick="setSetTab('${k}')">${l}<span class="n">${n[k]}</span></button>`;
    const body = setTab === 'plan' ? plansTable() : setTab === 'teacher' ? teachersTable() : allowedTable();
    return `<div class="setnav">${b('plan', '方案及價格')}${b('teacher', '任課老師')}${b('allowed', '管理者')}
        <button onclick="logout()">登出</button></div>
      <div class="setpane">${body}</div>`;
  };

  /* ── c1：事件修正 · 表格 ─────────────────────────────────
     現況是一列一張小卡（日期｜💲/🎻 姓名｜方案·狀態｜金額｜›）。
     改成表格之後多出「老師」一欄，而且日期／金額可以直接上下掃 ——
     跟報表的「本月繳費明細」同一批資料、同一種樣子。 */
  const eventsNarrow = window.eventsView;
  window.eventsView = function () {
    if (!isDesk() || P !== 'c1') return eventsNarrow();
    const f = ui.evFilter || 'all';
    const chip = (v, l, n) => `<button class="dk-f ${f === v ? 'on' : ''}" onclick="setEvFilter('${v}')">${l}${
      n != null ? ` <b>${n}</b>` : ''}</button>`;
    const nPay = (REPORTS.payments || []).length, nRent = DB.rentals.length;
    return `<div class="dk-bar">
        <button class="dk-add" onclick="go('report')">‹ 返回報表</button>
        ${chip('all', '全部', nPay + nRent)}${chip('pay', '💲 繳費', nPay)}${chip('rent', '🎻 租箏', nRent)}
        <input class="dk-search" placeholder="搜尋學生／承租人姓名" value="${ui.evSearch || ''}"
               oninput="setEvSearch(this.value)" oncompositionend="setEvSearch(this.value)">
      </div><div id="evbody">${eventsBody()}</div>`;
  };

  const eventsBodyNarrow = window.eventsBody;
  window.eventsBody = function () {
    if (!isDesk() || P !== 'c1') return eventsBodyNarrow();
    const f = ui.evFilter || 'all', q = (ui.evSearch || '').trim();
    let items = [];
    if (f !== 'rent' && REPORTS.payments) {
      REPORTS.payments.forEach(p => {
        const s = DB.students.find(x => x.id === p.student_id);
        items.push({ kind: 'pay', id: p.id, date: p.pay_date || '', name: s ? s.name : '（已刪除）',
          tch: s ? (teacherName(s.t) || '未指派') : '—',
          detail: `${p.billing || ''}${p.periods > 1 ? ' ×' + p.periods : ''}`,
          amount: (p.amount || 0) * (p.periods || 1) });
      });
    }
    if (f !== 'pay') {
      DB.rentals.forEach(r => items.push({ kind: 'rent', id: r.id, date: r.pay || r.start || '',
        name: r.name || '—', tch: rentalTeacher(r) || '—',
        detail: `${r.inst} · ${r.status}`, amount: null }));
    }
    if (q) items = items.filter(i => i.name.includes(q));
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (REPORTS.payments === null && f !== 'rent') return `<div class="empty">載入繳費紀錄中…</div>`;
    const cap = 120, shown = items.slice(0, cap);
    if (!shown.length) return `<div class="empty">沒有符合的事件</div>`;
    const rows = shown.map(i => {
      const click = i.kind === 'pay' ? `openPayEvent('${i.id}')` : `openRental('${i.id}')`;
      return `<tr class="clickable" onclick="${click}">
        <td class="c">${fmtDate2(i.date)}</td>
        <td class="c"><span class="badge ${i.kind === 'pay' ? 'j' : 'pipa'}">${i.kind === 'pay' ? '💲 繳費' : '🎻 租箏'}</span></td>
        <td class="sname">${i.name}</td>
        <td>${i.tch}</td>
        <td>${i.detail}</td>
        <td class="c">${i.amount != null
          ? `<b class="${i.amount < 0 ? 't-red' : 't-primary'}">$${i.amount.toLocaleString()}</b>` : '—'}</td>
      </tr>`;
    }).join('');
    return `<table class="dtable ev-tbl"><thead><tr>
        <th class="c">日期</th><th class="c">類型</th><th>姓名</th><th>老師</th>
        <th>內容</th><th class="c">金額</th>
      </tr></thead><tbody>${rows}</tbody></table>
      ${items.length > cap ? `<div class="empty sm">只顯示最近 ${cap} 筆，用搜尋縮小範圍</div>` : ''}`;
  };

  /* ── 掛到各自的渲染後面 ─────────────────────────────────── */
  const origStudent = window.renderStudentModal;
  window.renderStudentModal = function () {
    const r = origStudent.apply(this, arguments);
    const sheet = document.querySelector('#sov .sheet');
    if (P === 'a1') splitTwoCol(sheet);
    if (P === 'a2') applyPanes();
    return r;
  };
  setTimeout(() => {
    const sheet = document.querySelector('#sov .sheet');
    if (P === 'a1') splitTwoCol(sheet);
    if (P === 'a2') applyPanes();
  }, 1000);
})();
