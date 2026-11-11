/* mock-panel.js — 側欄面板排版整理（示意圖，正式程式沒有這一層）
 *
 *   ?p=d1  刪除放標題列的「⋯」選單
 *   ?p=d2  刪除放基本資料分頁底部的「危險操作」區
 *
 * 其餘排版修正兩案相同：
 *   1. 提示文字從標籤裡搬到控制項下面（標籤欄只放單行短標籤）
 *   2. 面板標題改成「這一筆是誰」，不重複頁名
 *   3. 租借的老師只出現一次（原本「已連結學生」跟「老師」各印一次）
 *   4. 繳費紀錄的日期改成跟老師異動歷史一樣的 YYYY/M/D
 *   5. 記繳費分頁去掉底框
 */
(function () {
  const P = new URLSearchParams(location.search).get('p') || '';
  if (!/^(d[12]|e[12]|f[123])$/.test(P)) return;
  document.body.dataset.p = P;

  const badge = document.createElement('div');
  badge.className = 'opt-badge';
  badge.textContent = {
    d1: '示意 · 面板整理：刪除放「⋯」選單',
    d2: '示意 · 面板整理：刪除放危險操作區',
    e1: '示意 · 標題即姓名（姓名只出現一次）',
    e2: '示意 · 標題是動作（姓名只留在欄位）',
    f1: '示意 · 刪除 a：一行框（說明與按鈕同排）',
    f2: '示意 · 刪除 b：純文字連結',
    f3: '示意 · 刪除 c：外框按鈕＋一行小字',
  }[P];
  const BASE = /^f/.test(P) ? 'e1' : P;        // f 系列都是 e1 的版面，只差刪除怎麼擺
  const DEL = /^[ef]/.test(P) ? 'd2' : P;
  const DZ = /^f/.test(P) ? P[1] : '0';        // 0＝原本那個大紅框
  document.body.appendChild(badge);

  window.toggleSheetMenu = function (e) {
    const m = document.querySelector('.sheet-menu');
    if (m) m.hidden = !m.hidden;
    if (e) e.stopPropagation();
  };
  addEventListener('click', () => {
    const m = document.querySelector('.sheet-menu');
    if (m) m.hidden = true;
  });

  /* 標題：這一筆是誰，不是重複一次頁名 */
  function titleOf(id) {
    const act = { sov:['新增學生','編輯學生'], rov:['新增租借','編輯租借'],
                  pov:['新增方案','編輯方案'], tov:['新增老師','編輯老師'] }[id];
    if (!act) return null;
    const m = { sov: ui.smodal, rov: ui.rmodal, pov: ui.pmodal, tov: ui.tmodal }[id] || {};
    // e2 與 d 案：標題只說「在做什麼」，姓名留在欄位裡
    // e1：標題就是姓名本身（下面的姓名欄會被移除），切到任何分頁都看得到在編誰
    if (BASE === 'e1' && !m.isNew && (id === 'sov' || id === 'rov')) return ['__NAME__', act[1]];
    return [act[m.isNew ? 0 : 1], ''];
  }

  function fixSheet(id) {
    const sheet = document.querySelector('#' + id + ' .sheet');
    if (!sheet || sheet.dataset.fixed) return;
    sheet.dataset.fixed = '1';

    /* 1. 提示文字：從 <label> 裡搬出來，放到控制項下面 */
    sheet.querySelectorAll('.field > label .sublabel').forEach(sp => {
      const field = sp.closest('.field');
      const hint = document.createElement('div');
      hint.className = 'fieldhint';
      hint.textContent = sp.textContent.replace(/[（）()]/g, '').trim();
      sp.remove();
      field.appendChild(hint);
    });

    /* 2. 標題改成記錄本身的身分，右邊放動作 */
    const h3 = sheet.querySelector('h3');
    const t = titleOf(id);
    if (h3 && t) {
      const close = h3.querySelector('.sheet-x');
      const nameField = sheet.querySelector('.f-name');
      let ttl;
      if (t[0] === '__NAME__' && nameField) {
        // 標題就是姓名：把姓名輸入框搬上來當標題，下面那一欄整個移除
        const inp = nameField.querySelector('.inp');
        const sug = nameField.querySelector('#rsug');
        ttl = `<span class="sheet-ttl"><span class="t"><input class="ttl-inp" value="${
          (inp && inp.value || '').replace(/"/g, '&quot;')}"></span><span class="s">${t[1]}</span></span>`;
        h3.innerHTML = ttl + '<span class="sheet-acts"></span>';
        const ti = h3.querySelector('.ttl-inp');
        if (inp && ti) ti.setAttribute('oninput', inp.getAttribute('oninput') || '');
        if (sug) h3.querySelector('.sheet-ttl').appendChild(sug);   // 連結狀態跟著姓名走
        nameField.remove();
      } else {
        h3.innerHTML = `<span class="sheet-ttl"><span class="t">${t[0]}</span>${
          t[1] ? `<span class="s">${t[1]}</span>` : ''}</span><span class="sheet-acts"></span>`;
      }
      const acts = h3.querySelector('.sheet-acts');
      if (DEL === 'd1' && id === 'sov' && !(ui.smodal || {}).isNew) {
        acts.insertAdjacentHTML('beforeend',
          `<button class="sheet-more" onclick="toggleSheetMenu(event)" title="更多">⋯</button>
           <div class="sheet-menu" hidden><button onclick="deleteStudent()">🗑 刪除這位學生</button></div>`);
      }
      if (close) acts.appendChild(close);
    }

    /* 3. 租借的連結狀態：原本印「已連結學生：陳品妍 · 王美華」——
       姓名在輸入框裡已經有了，老師在下面也有自己的欄位，整行等於重複兩次。
       這一行真正要回答的是「這個人有沒有對應到系統裡的學生」，所以只留狀態。 */
    const link = sheet.querySelector('.rlink.ok');
    if (link) link.textContent = '✓ 已對應系統學生';

    /* 4. 繳費紀錄的日期改成跟老師異動歷史一致的 YYYY/M/D，並且給固定欄寬 */
    sheet.querySelectorAll('.f-hist .histrow.pay').forEach((row, i) => {
      const h = (ui.smodal && ui.smodal.history) ? ui.smodal.history[i] : null;
      const first = row.firstElementChild;
      if (h && first) {
        first.innerHTML = `<span class="hdate">${fmtDate2(h.pay_date)}</span>`
          + `<span class="t-muted">${h.billing || ''}${h.periods > 1 ? ' ×' + h.periods : ''}</span>`;
        first.style.display = 'flex';
        first.style.gap = '10px';
      }
    });
    sheet.querySelectorAll('.f-tchlog .histrow span:first-child').forEach(sp => sp.classList.add('hdate'));

    /* 5. 記繳費：金額與日期包成一排，底框由 CSS 去掉 */
    const box = sheet.querySelector('.paybox');
    if (box && sheet.querySelector('.sheet-tabs')) {
      const amt = box.querySelector('input[type="number"]');
      const date = box.querySelector('input[type="date"]');
      if (amt && date && !box.querySelector('.payrow')) {
        const row = document.createElement('div');
        row.className = 'payrow';
        box.insertBefore(row, amt);
        row.appendChild(amt); row.appendChild(date);
      }
    }

    /* 6. d2：刪除收進基本資料分頁底部的「危險操作」區 */
    const del = sheet.querySelector('.btn-del');
    if (del) {
      if (DEL === 'd1') del.remove();                     // 已經搬到 ⋯ 選單
      else if (sheet.querySelector('.sheet-tabs')) {
        if ((ui.smodal || {}).pane !== 'data') del.remove();
        else {
          const dz = document.createElement('div');
          del.parentNode.insertBefore(dz, del);
          if (DZ === '1') {
            // a：說明與按鈕同一排，淡框不填色
            dz.className = 'dz dz-a';
            dz.innerHTML = '<span class="dz-d">刪除後不再出現在 App，紀錄保留</span>';
            del.textContent = '🗑 刪除';
            dz.appendChild(del);
          } else if (DZ === '2') {
            // b：只留一個紅色文字連結，後果在確認視窗裡講（那裡本來就會列出保留什麼）
            dz.className = 'dz dz-b';
            del.className = 'dz-link';
            del.textContent = '刪除這位學生';
            dz.appendChild(del);
          } else if (DZ === '3') {
            // c：外框按鈕，底下一行小字
            dz.className = 'dz dz-c';
            dz.appendChild(del);
            dz.insertAdjacentHTML('beforeend', '<div class="dz-d">紀錄保留，App 內無法還原</div>');
          } else {
            dz.className = 'danger-zone';
            dz.innerHTML = `<div class="dz-t">危險操作</div>
              <div class="dz-d">刪除後這位學生不再出現在 App 裡，繳費與租借紀錄保留；App 內無法還原。</div>`;
            dz.appendChild(del);
          }
        }
      }
    }
  }

  ['renderStudentModal', 'renderRentalModal', 'renderPlanModal', 'renderTeacherModal', 'renderPayEvent', 'renderModal']
    .forEach(fn => {
      const orig = window[fn];
      if (typeof orig !== 'function') return;
      const id = { renderStudentModal: 'sov', renderRentalModal: 'rov', renderPlanModal: 'pov',
                   renderTeacherModal: 'tov', renderPayEvent: 'peov', renderModal: 'ov' }[fn];
      window[fn] = function () { const r = orig.apply(this, arguments); fixSheet(id); return r; };
    });
  setTimeout(() => ['sov', 'rov', 'pov', 'tov', 'peov', 'ov'].forEach(fixSheet), 1000);
})();
