/* rwd-demo.js — RWD 比稿頁的行為模擬（只給挑版面用，不是正式程式）
 *
 * 做三件事：
 *   1. 寬螢幕時把表格補成「資料有、現在畫面沒放」的欄位（三案共用）
 *   2. B／C 案：把 6 個彈窗的 overlay 搬進右欄 #side，變成常駐詳情面板
 *   3. C 案：核對頁改成所有老師同時並排（ui.tab 的狀態保留不刪）
 *
 * 真正實作時這些邏輯會寫回 prototype/js/，這裡只是先讓使用者看得到。
 */
(function () {
  const OPT = (new URLSearchParams(location.search).get('opt') || '').toLowerCase();
  if (!/^[abcd]$/.test(OPT)) return;

  const wide = () => matchMedia('(min-width: 760px)').matches;
  const panel = () => /^[bcd]$/.test(OPT) && matchMedia('(min-width: 1100px)').matches;

  /* 左上角的方案標籤，正式版不會有 */
  const badge = document.createElement('div');
  badge.className = 'opt-badge';
  badge.textContent = { a: 'A 案 · 左側導覽＋單欄寬版',
                        b: 'B 案 · ＋右側詳情面板',
                        c: 'C 案 · ＋核對頁老師並排',
                        d: 'D 案 · 詳情面板重排版' }[OPT];
  document.body.appendChild(badge);

  /* ── 1. 待辦：老師由分組列改成欄位，另補方案、上次繳費 ───────── */
  const todoNarrow = window.todoView;
  window.todoView = function () {
    if (!wide()) return todoNarrow();
    const due = DB.students.filter(isDue);
    if (!due.length) return '<div class="empty todo-empty">目前沒有即將上完的學生 🎉</div>';
    let h = '<div class="addbar"><button class="addstu" onclick="exportTodo()">⬇ 匯出待繳名單</button></div>'
      + '<div class="hint2">點學生即可<b class="t-primary">記繳費</b>（記後已上堂數自動扣方案堂數）</div>'
      + '<table class="dtable todo"><colgroup><col><col><col><col><col><col></colgroup>'
      + '<thead><tr><th>姓名</th><th>老師</th><th>方案</th><th>已上堂數</th><th>上次繳費</th><th>備註</th></tr></thead><tbody>';
    due.forEach(s => {
      h += '<tr class="clickable" onclick="openPay(\'' + s.id + '\')">'
        + '<td class="sname">' + s.name + '</td>'
        + '<td>' + (teacherName(s.t) || '—') + '</td>'
        + '<td class="c"><span class="badge ' + planClass(s.plan) + '">' + s.plan + '</span></td>'
        + '<td class="c att">' + s.attended + '</td>'
        + '<td class="c">' + fmtDate(s.pay) + '</td>'
        + '<td class="note">' + (s.note || '—') + '</td></tr>';
    });
    return h + '</tbody></table>';
  };

  /* ── 2. 租借：補樂器、方案兩欄（原本只有姓名／起租／到期／狀態）── */
  const rentalNarrow = window.rentalView;
  window.rentalView = function () {
    if (!wide()) return rentalNarrow();
    const showReturned = ui.rentTab === 'returned';
    const list = DB.rentals.filter(r => showReturned ? r.status === '已還箏' : r.status === '租賃中')
                           .sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1);
    const activeCnt = DB.rentals.filter(r => r.status === '租賃中').length;
    let h = '<div class="rtabs">'
      + '<button class="rtab ' + (!showReturned ? 'active' : '') + '" onclick="setRentTab(\'active\')">租賃中 ' + activeCnt + '</button>'
      + '<button class="rtab ' + (showReturned ? 'active' : '') + '" onclick="setRentTab(\'returned\')">已還箏</button>'
      + '<button class="raddmini" onclick="openRental(null)">＋ 新增</button></div>';
    if (!list.length) return h + '<div class="empty">' + (showReturned ? '沒有已還箏紀錄' : '目前沒有租賃中的器材') + '</div>';
    h += '<table class="dtable rtable"><colgroup><col><col><col><col><col><col></colgroup>'
      + '<thead><tr><th>姓名</th><th class="c">樂器</th><th class="c">方案</th><th class="c">起租日</th>'
      + '<th class="c">' + (showReturned ? '還箏日' : '到期日') + '</th><th class="c">狀態</th></tr></thead><tbody>';
    list.forEach(r => {
      const st = rentalState(r);
      const dueCls = st === 'overdue' ? 'due-over' : (st === 'soon' ? 'due-soon' : '');
      const pill = st === 'overdue' ? '<span class="rst rst-over">逾期</span>'
                 : st === 'soon' ? '<span class="rst rst-soon">本月到期</span>'
                 : st === 'returned' ? '<span class="rst rst-done">已還</span>'
                 : '<span class="rst rst-active">租賃中</span>';
      h += '<tr onclick="openRental(\'' + r.id + '\')">'
        + '<td class="sname">' + (r.name || '—') + (r.note ? '<div class="meta">' + r.note + '</div>' : '') + '</td>'
        + '<td class="c">' + (r.inst || '—') + '</td>'
        + '<td class="c"><span class="badge ' + planClass(r.billing) + '">' + (r.billing || '—') + '</span></td>'
        + '<td class="c">' + fmtDate(r.start) + '</td>'
        + '<td class="c ' + dueCls + '">' + fmtDate(showReturned ? r.returned : r.due) + '</td>'
        + '<td class="c">' + pill + '</td></tr>';
    });
    return h + '</tbody></table>';
  };

  /* ── 3. C 案：核對頁所有老師同時並排 ───────────────────────── */
  if (OPT === 'c' || OPT === 'd') {
    const bodyNarrow = window.checkBody, viewNarrow = window.checkView;

    window.checkBody = function () {
      if (!wide() || (ui.search || '').trim()) return bodyNarrow();
      const total = DB.students.filter(s => s.checked).length;
      const strip = total ? '<div class="nrstrip"><span>本梯已核對 <b>' + total + '</b> 位</span>'
        + '<span class="nr-clr" onclick="clearAllChecks()">清除·開始新一梯</span></div>' : '';
      let cols = '';
      activeTeachers().forEach(t => {
        const list = DB.students.filter(s => s.t === t.id && isActive(s));
        const pending = list.filter(s => !s.checked), done = list.filter(s => s.checked);
        const rows = pending.length ? pending.map(checkRowHtml).join('')
          : '<div class="empty sm">' + (list.length ? '都核對完成 🎉' : '這位老師目前沒有上課中的學生') + '</div>';
        cols += '<div class="chk-col">'
          + '<div class="chk-colhead">' + t.name + t.role + '<span class="cnt">在學 ' + list.length + '</span></div>'
          + '<div class="chk-card"><div class="chk-chead"><span class="chk-ttl">待核對 <b>' + pending.length + '</b></span>'
          + '<button class="chk-add" onclick="openStudent(null)">＋ 新增</button></div>' + rows + '</div>'
          + (done.length ? '<div class="chk-card done"><div class="chk-chead"><span class="chk-ttl">已核對 <b>'
              + done.length + '</b></span></div>' + done.map(checkRowHtml).join('') + '</div>' : '')
          + '</div>';
      });
      return strip + '<div class="chk-cols">' + cols + '</div>';
    };

    window.checkView = function () {
      if (!wide()) return viewNarrow();
      // 老師全部攤開了，頁籤沒有意義 → 這排只留搜尋。ui.tab 不動，縮回手機要還原。
      const topRow = '<div class="tabsrow">'
        + '<button class="srch-ic ' + (ui.search ? 'on' : '') + '" onclick="'
        + (ui.search ? 'closeSearch()' : 'openSearch()') + '">🔍</button>'
        + '<input class="searchbox2" placeholder="搜尋學生姓名（跨所有老師）" value="' + (ui.search || '') + '"'
        + ' oninput="setSearch(this.value)" oncompositionend="setSearch(this.value)">'
        + '</div>';
      return topRow + '<div id="cbody">' + checkBody() + '</div>';
    };
  }

  /* ── 4. B／C 案：右欄 #side ＋ 把彈窗的 overlay 搬進去 ─────────
     #side 的節點用變數留著，render() 重寫 #app.innerHTML 時
     只是把它拆下來，裡面開著的詳情不會被毀掉，再接回去就好。 */
  const HOSTS = ['ov', 'sov', 'rov', 'tov', 'pov', 'peov'];
  let side = null, sideEmpty = null;

  if (/^[bcd]$/.test(OPT)) {
    side = document.createElement('aside');
    side.id = 'side';
    sideEmpty = document.createElement('div');
    sideEmpty.className = 'side-empty';
    side.appendChild(sideEmpty);

    // 彈窗是在 document.body 上現生的 → 一出現就搬進右欄
    new MutationObserver(muts => {
      muts.forEach(m => Array.prototype.forEach.call(m.addedNodes, n => {
        if (n.nodeType === 1 && HOSTS.indexOf(n.id) >= 0 && panel()) side.appendChild(n);
      }));
    }).observe(document.body, { childList: true });
  }

  /* 右欄沒開詳情時顯示的內容：該頁的輔助資訊 */
  function sideEmptyHtml() {
    const line = (l, v) => '<div class="srow-mini"><span>' + l + '</span><b>' + v + '</b></div>';
    if (ui.screen === 'check') {
      const rows = activeTeachers().map(t => {
        const list = DB.students.filter(s => s.t === t.id && isActive(s));
        return line(t.name + t.role, list.filter(s => s.checked).length + ' / ' + list.length);
      }).join('');
      const done = DB.students.filter(s => s.checked).length;
      return '<h4>本梯進度</h4><div class="k">' + done + '</div><div class="kl">位已核對</div>' + rows
        + '<div class="tip">點左邊的學生姓名，資料就開在這一欄，不用再開關彈窗。</div>';
    }
    if (ui.screen === 'todo') {
      const due = DB.students.filter(isDue);
      const rows = activeTeachers().map(t => line(t.name + t.role, due.filter(s => s.t === t.id).length + ' 位')).join('');
      return '<h4>本期待辦</h4><div class="k">' + due.length + '</div><div class="kl">位即將完課</div>' + rows
        + '<div class="tip">點左邊任一位，記繳費就開在這一欄。</div>';
    }
    if (ui.screen === 'rental') {
      const over = DB.rentals.filter(r => rentalState(r) === 'overdue').length;
      const soon = DB.rentals.filter(r => rentalState(r) === 'soon').length;
      const act = DB.rentals.filter(r => r.status === '租賃中').length;
      return '<h4>器材狀況</h4><div class="k">' + act + '</div><div class="kl">件租賃中</div>'
        + line('逾期', over + ' 件') + line('本月到期', soon + ' 件')
        + '<div class="tip">點左邊任一筆，續租／還箏就開在這一欄。</div>';
    }
    if (ui.screen === 'report') return '<h4>報表</h4><div class="tip">點明細裡的任一筆繳費，就能在這一欄直接修正。</div>';
    if (ui.screen === 'setting') return '<h4>設定</h4><div class="tip">點方案或老師，編輯就開在這一欄。</div>';
    return '<h4>事件修正</h4><div class="tip">點任一筆事件，就能在這一欄直接修正。</div>';
  }

  /* ── 4b. D 案：替每個欄位掛上辨識用的 class ─────────────────
     CSS 要「依內容給寬度」就得認得出哪一欄是姓名、哪一欄是已上堂數。
     比稿頁用標籤文字回頭貼 class；真的實作時直接寫進各 modal 的樣板即可。 */
  let tagFields = null;
  if (OPT === 'd') {
    const FIELD_CLASS = {
      '姓名': 'f-name', '任課老師': 'f-tch', '學習樂器': 'f-inst', '授課類型': 'f-type',
      '雙人組同學': 'f-partner', '方案': 'f-plan', '狀態': 'f-status',
      '已上堂數': 'f-att', '備註': 'f-note', '繳費紀錄': 'f-hist', '老師異動歷史': 'f-tchlog',
      '承租人': 'f-name', '樂器': 'f-inst', '繳別': 'f-plan', '起租日': 'f-date',
      '到期日': 'f-date', '還箏日': 'f-date', '繳費日': 'f-date', '金額': 'f-amt',
      '期數': 'f-att', '租借歷史': 'f-hist',
    };
    tagFields = function () {
      document.querySelectorAll('.sheet .field > label').forEach(l => {
        const c = FIELD_CLASS[l.textContent.trim()];
        if (c) l.parentNode.classList.add(c);
      });
    };
    ['renderStudentModal', 'renderRentalModal', 'renderModal',
     'renderPayEvent', 'renderPlanModal', 'renderTeacherModal'].forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      window[fn] = function () { const r = orig.apply(this, arguments); tagFields(); return r; };
    });
  }

  /* ── 5. render() 之後把右欄接回 #app ───────────────────────── */
  const renderOrig = window.render;
  window.render = function () {
    renderOrig.apply(this, arguments);
    const app = document.getElementById('app');
    if (side && app && ui.screen !== 'login' && ui.screen !== 'denied') {
      sideEmpty.innerHTML = sideEmptyHtml();
      app.appendChild(side);
      // 第一次進來、彈窗已經先長在 body 上的情況
      if (panel()) HOSTS.forEach(id => {
        const h = document.getElementById(id);
        if (h && h.parentNode !== side) side.appendChild(h);
      });
    }
  };

  // 跨斷點時要重畫（手機↔電腦的版面差太多，不能只靠 CSS）
  matchMedia('(min-width: 760px)').addEventListener('change', () => render());
  matchMedia('(min-width: 1100px)').addEventListener('change', () => render());

  render();
  if (tagFields) tagFields();   // mock.js 的第一次 paint 比這支早，補貼一次
})();
