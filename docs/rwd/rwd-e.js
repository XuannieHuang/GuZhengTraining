/* rwd-e.js — E 案（重新設計的桌機版面）的行為模擬
 *
 * 只給挑版面用，不是正式程式。≥1024px 時改走桌機分支，
 * 窄螢幕一律回到原本的手機程式，一個字都不改。
 *
 * 做三件事：
 *   1. 學生工作台 —— 把手機的「待辦」與「核對」合成一張可篩選的表
 *   2. 右欄 #side —— 把彈窗的 overlay 搬進去，當成「選取的那一筆」
 *   3. 表單欄位掛 class，讓 CSS 能依內容給寬度
 */
(function () {
  if ((new URLSearchParams(location.search).get('opt') || '') !== 'e') return;

  const desk = () => matchMedia('(min-width: 1024px)').matches;
  // 寬度不夠同時放表格跟面板時，詳情維持原本的置中彈窗
  const panelOn = () => matchMedia('(min-width: 1280px)').matches;

  const badge = document.createElement('div');
  badge.className = 'opt-badge';
  badge.textContent = 'E 案 · 重新設計的桌機版面';
  document.body.appendChild(badge);

  /* ── 1. 學生工作台 ─────────────────────────────────────────
     ui.dkFilter: all | due（即將完課）| todo（還沒核對）
     篩選只是換 filter，資料來源完全沒變。 */
  if (!('dkFilter' in ui)) ui.dkFilter = 'all';
  window.setDkFilter = function (v) { ui.dkFilter = v; render(); };

  const checkViewNarrow = window.checkView;
  const checkBodyNarrow = window.checkBody;

  function dkList() {
    let list = DB.students.filter(isActive);
    const q = (ui.search || '').trim();
    if (q) list = list.filter(s => s.name.includes(q));
    if (ui.dkFilter === 'due')  list = list.filter(isDue);
    if (ui.dkFilter === 'todo') list = list.filter(s => !s.checked);
    return list;
  }

  function dkRow(s) {
    const due = isDue(s);
    const cls = (s.checked ? 'checked' : '') + (due ? ' due' : '');
    return '<tr class="' + cls + '">'
      + '<td class="c-chk"><div class="chk ' + (s.checked ? 'on' : '') + '" data-act="chk" data-id="' + s.id + '">✓</div></td>'
      + '<td class="sname"><span class="ename" data-act="edit" data-id="' + s.id + '">' + s.name + '</span>'
        + (s.type === '雙人' ? ' <span class="badge dual">👥 ' + (s.partner ? studentName(s.partner) : '未配對') + '</span>' : '') + '</td>'
      + '<td class="c"><span class="badge ' + planClass(s.plan) + '">' + s.plan + '</span></td>'
      + '<td class="c"><div class="numwrap">'
        + '<input class="num ' + (due ? 'due' : '') + '" type="number" inputmode="numeric" value="' + s.attended + '" data-act="num" data-id="' + s.id + '">'
        + '<button class="signbtn" data-act="sign" data-id="' + s.id + '" title="正負切換">±</button></div></td>'
      + '<td class="c">' + fmtDate(s.pay) + '</td>'
      + '<td class="c dk-st">' + s.status + '</td>'
      + '<td class="note">' + (s.note || '—') + '</td>'
      + '<td class="c">' + (due ? '<button class="dk-pay" onclick="openPay(\'' + s.id + '\')">💲 記繳費</button>' : '') + '</td>'
      + '</tr>';
  }

  // 只有這塊會被搜尋重繪（不碰搜尋框本身，注音組字才不會被打斷）
  window.checkBody = function () {
    if (!desk()) return checkBodyNarrow();
    const list = dkList();
    if (!list.length) return '<div class="empty">沒有符合的學生</div>';
    const ats = activeTeachers();
    let rows = '';
    ats.forEach(t => {
      const grp = list.filter(s => s.t === t.id);
      if (!grp.length) return;
      const done = grp.filter(s => s.checked).length;
      rows += '<tr class="ghead"><td colspan="8">' + t.name + t.role
        + ' · ' + grp.length + ' 位 · 已核對 ' + done + '</td></tr>'
        + grp.map(dkRow).join('');
    });
    const orph = list.filter(s => !ats.find(t => t.id === s.t));
    if (orph.length) rows += '<tr class="ghead"><td colspan="8">⚠ 待指派 · ' + orph.length + ' 位</td></tr>'
      + orph.map(dkRow).join('');
    return '<table class="dtable dk-table"><thead><tr>'
      + '<th></th><th>姓名</th><th class="c">方案</th><th class="c">已上堂數</th>'
      + '<th class="c">上次繳費</th><th class="c">狀態</th><th>備註</th><th></th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>';
  };

  window.checkView = function () {
    if (!desk()) return checkViewNarrow();
    const act = DB.students.filter(isActive);
    const nDue = act.filter(isDue).length;
    const nTodo = act.filter(s => !s.checked).length;
    const done = DB.students.filter(s => s.checked).length;
    const f = (k, l, n) => '<button class="dk-f ' + (ui.dkFilter === k ? 'on' : '') + '" onclick="setDkFilter(\'' + k + '\')">'
      + l + ' <b>' + n + '</b></button>';
    const bar = '<div class="dk-bar">'
      + f('all', '全部', act.length) + f('due', '即將完課', nDue) + f('todo', '還沒核對', nTodo)
      + '<input class="dk-search" placeholder="搜尋學生姓名" value="' + (ui.search || '') + '"'
      + ' oninput="setSearch(this.value)" oncompositionend="setSearch(this.value)">'
      + '<button class="dk-add" onclick="openStudent(null)">＋ 新增學生</button>'
      + '<div class="dk-prog">本梯已核對 <b>' + done + '</b>'
      + (done ? ' · <span class="nr-clr" onclick="clearAllChecks()">清除·開始新一梯</span>' : '') + '</div>'
      + '</div>';
    return bar + '<div id="cbody">' + checkBody() + '</div>';
  };

  /* ── 1b. 器材租借：同一套做法 —— 篩選列在上、欄位貼合內容 ───── */
  const rentalNarrow = window.rentalView;
  window.rentalView = function () {
    if (!desk()) return rentalNarrow();
    const showReturned = ui.rentTab === 'returned';
    const list = DB.rentals.filter(r => showReturned ? r.status === '已還箏' : r.status === '租賃中')
                           .sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1);
    const activeCnt = DB.rentals.filter(r => r.status === '租賃中').length;
    const doneCnt = DB.rentals.filter(r => r.status === '已還箏').length;
    const over = DB.rentals.filter(r => rentalState(r) === 'overdue').length;
    const soon = DB.rentals.filter(r => rentalState(r) === 'soon').length;
    let h = '<div class="dk-bar">'
      + '<button class="dk-f ' + (!showReturned ? 'on' : '') + '" onclick="setRentTab(\'active\')">租賃中 <b>' + activeCnt + '</b></button>'
      + '<button class="dk-f ' + (showReturned ? 'on' : '') + '" onclick="setRentTab(\'returned\')">已還箏 <b>' + doneCnt + '</b></button>'
      + '<button class="dk-add" onclick="openRental(null)">＋ 新增租借</button>'
      + '<div class="dk-prog">逾期 <b>' + over + '</b> · 本月到期 <b>' + soon + '</b></div>'
      + '</div>';
    if (!list.length) return h + '<div class="empty">' + (showReturned ? '沒有已還箏紀錄' : '目前沒有租賃中的器材') + '</div>';
    h += '<table class="dtable rtable"><thead><tr><th>姓名</th><th class="c">樂器</th><th class="c">方案</th>'
      + '<th class="c">起租日</th><th class="c">' + (showReturned ? '還箏日' : '到期日') + '</th>'
      + '<th class="c">狀態</th><th>備註</th></tr></thead><tbody>';
    list.forEach(r => {
      const st = rentalState(r);
      const dueCls = st === 'overdue' ? 'due-over' : (st === 'soon' ? 'due-soon' : '');
      const pill = st === 'overdue' ? '<span class="rst rst-over">逾期</span>'
                 : st === 'soon' ? '<span class="rst rst-soon">本月到期</span>'
                 : st === 'returned' ? '<span class="rst rst-done">已還</span>'
                 : '<span class="rst rst-active">租賃中</span>';
      h += '<tr onclick="openRental(\'' + r.id + '\')">'
        + '<td class="sname">' + (r.name || '—') + '</td>'
        + '<td class="c">' + (r.inst || '—') + '</td>'
        + '<td class="c"><span class="badge ' + planClass(r.billing) + '">' + (r.billing || '—') + '</span></td>'
        + '<td class="c">' + fmtDate(r.start) + '</td>'
        + '<td class="c ' + dueCls + '">' + fmtDate(showReturned ? r.returned : r.due) + '</td>'
        + '<td class="c">' + pill + '</td>'
        + '<td class="note">' + (r.note || '—') + '</td></tr>';
    });
    return h + '</tbody></table>';
  };

  // 桌機沒有獨立的「待辦」頁 —— 它就是工作台套上「即將完課」篩選
  const goNarrow = window.go;
  window.go = function (s) {
    if (desk() && s === 'todo') { ui.dkFilter = 'due'; return goNarrow('check'); }
    if (desk() && s === 'check' && ui.screen !== 'check') ui.dkFilter = 'all';
    return goNarrow(s);
  };
  const renderOrig0 = window.render;
  window.render = function () {
    // 桌機進到待辦頁時直接轉成工作台
    if (desk() && ui.screen === 'todo') { ui.screen = 'check'; ui.dkFilter = 'due'; }
    return renderOrig0.apply(this, arguments);
  };

  /* ── 2. 右欄 ───────────────────────────────────────────── */
  const HOSTS = ['ov', 'sov', 'rov', 'tov', 'pov', 'peov'];
  const side = document.createElement('aside');
  side.id = 'side';

  new MutationObserver(muts => {
    muts.forEach(m => Array.prototype.forEach.call(m.addedNodes, n => {
      if (n.nodeType === 1 && HOSTS.indexOf(n.id) >= 0 && panelOn()) side.appendChild(n);
    }));
  }).observe(document.body, { childList: true });

  /* ── 3. 欄位掛 class（真的實作時直接寫進各 modal 的樣板） ───── */
  const FIELD_CLASS = {
    '姓名': 'f-name', '任課老師': 'f-tch', '學習樂器': 'f-inst', '授課類型': 'f-type',
    '雙人組同學': 'f-partner', '方案': 'f-plan', '狀態': 'f-status',
    '已上堂數': 'f-att', '備註': 'f-note', '繳費紀錄': 'f-hist', '老師異動歷史': 'f-tchlog',
    '承租人姓名': 'f-name', '樂器': 'f-inst', '繳別': 'f-plan', '起租日': 'f-date',
    '到期日': 'f-date', '還箏日': 'f-date', '繳費日': 'f-date', '金額': 'f-amt',
    '期數': 'f-att', '租借歷史': 'f-hist',
  };
  function tagFields() {
    document.querySelectorAll('.sheet .field > label').forEach(l => {
      const c = FIELD_CLASS[l.textContent.trim()];
      if (c) l.parentNode.classList.add(c);
    });
  }
  ['renderStudentModal', 'renderRentalModal', 'renderModal',
   'renderPayEvent', 'renderPlanModal', 'renderTeacherModal'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function') return;
    window[fn] = function () { const r = orig.apply(this, arguments); tagFields(); return r; };
  });

  /* 報表頁在桌機要攤成多欄儀表板。
     它的 DOM 是「區段標題、表格、區段標題、表格…」一路平鋪，
     沒有可以抓的容器，所以這裡依標題把每一段包成一個 <section>。
     比稿頁用 DOM 後處理；真的實作時直接在樣板裡包起來。 */
  function groupSections(main) {
    if (main.querySelector('.dk-sec')) return;
    let cur = null;
    Array.prototype.slice.call(main.children).forEach(el => {
      if (el.classList.contains('section-title')) {
        cur = document.createElement('section');
        cur.className = 'dk-sec';
        main.insertBefore(cur, el);
      }
      if (cur) cur.appendChild(el);
    });
  }

  /* 桌機沒有「待辦」這一頁了（它是工作台的一個篩選），
     所以導覽也要少一顆：待辦拿掉，核對改叫「學生」，待繳的徽章搬過去。
     比稿頁用 DOM 後處理；真的實作時直接改 app.js 的樣板。 */
  function deskNav(app) {
    const nav = app.querySelector('nav');
    if (!nav) return;
    const bs = nav.querySelectorAll('button');
    if (bs.length < 2) return;
    const badgeHtml = bs[0].querySelector('.navbadge');
    bs[0].remove();
    const stu = nav.querySelector('button');
    stu.innerHTML = stu.innerHTML.replace('核對', '學生')
      + (badgeHtml ? badgeHtml.outerHTML : '');
    if (ui.screen === 'check') {
      const h1 = app.querySelector('header h1');
      if (h1) h1.textContent = '學生';
      const n = DB.students.filter(isDue).length;
      if (n && !app.querySelector('header .sub')) {
        h1.insertAdjacentHTML('afterend',
          '<div class="sub"><span class="tdot"></span>本期即將完課 ' + n + ' 位</div>');
      }
    }
  }

  /* ── render() 之後把右欄接回 #app ───────────────────────── */
  const renderOrig = window.render;
  window.render = function () {
    renderOrig.apply(this, arguments);
    const app = document.getElementById('app');
    if (app && ui.screen !== 'login' && ui.screen !== 'denied') {
      if (desk()) {
        deskNav(app);
        if (ui.screen === 'report') groupSections(app.querySelector('main'));
      }
      app.appendChild(side);
      if (panelOn()) HOSTS.forEach(id => {
        const h = document.getElementById(id);
        if (h && h.parentNode !== side) side.appendChild(h);
      });
    }
  };

  matchMedia('(min-width: 1024px)').addEventListener('change', () => render());
  matchMedia('(min-width: 1280px)').addEventListener('change', () => render());

  render();
  tagFields();   // mock.js 的第一次 paint 比這支早，補貼一次
})();
