/* panel-2col.js — 提案：編輯面板改兩欄（比稿用，正式程式沒有動）
 *
 * 兩件事：
 *   1. 把 .sheet 裡的欄位分成兩組：
 *        左欄 col-a ＝ 這個人是誰（姓名、老師、樂器、類型、方案、狀態、已上堂數、備註）
 *        右欄 col-b ＝ 這個人的帳（記一筆繳費、繳費紀錄、老師異動歷史）
 *      真的要做的話會直接寫進 modal-*.js 的樣板，這裡先用 DOM 後處理示範。
 *   2. 面板開著又不夠寬時，給 #app 加 .narrow-edit，
 *      讓表格暫時收掉「上次繳費／狀態」兩欄，把寬度讓給面板。
 */
(function () {
  if (new URLSearchParams(location.search).get('p') !== '2col') return;

  const badge = document.createElement('div');
  badge.className = 'opt-badge';
  badge.textContent = '提案 · 編輯面板兩欄';
  document.body.appendChild(badge);

  const RIGHT = ['paybox', 'f-hist', 'f-tchlog'];
  const SKIP = ['handle', 'actions', 'btn-del', 'sub-h', 'resetlink'];

  function split(hostId) {
    const sheet = document.querySelector('#' + hostId + ' .sheet');
    if (!sheet || sheet.querySelector('.col-a')) return;
    const a = document.createElement('div'); a.className = 'col-a';
    const b = document.createElement('div'); b.className = 'col-b';
    const kids = Array.prototype.slice.call(sheet.children);
    kids.forEach(el => {
      if (el.tagName === 'H3') return;
      if (SKIP.some(c => el.classList.contains(c))) return;
      (RIGHT.some(c => el.classList.contains(c)) ? b : a).appendChild(el);
    });
    const anchor = sheet.querySelector('.btn-del') || sheet.querySelector('.actions');
    sheet.insertBefore(a, anchor);
    sheet.insertBefore(b, anchor);
    boxHistory(sheet);
    footer(sheet);
  }

  /* 兩欄之後「取消／儲存」變成格子裡的一格，sticky 在自己那一格裡沒有空間可以黏，
     會被內容推到看不見。改成橫跨兩欄的固定底列，儲存就永遠在。 */
  function footer(sheet) {
    if (sheet.querySelector('.sheet-foot')) return;
    const acts = sheet.querySelector('.actions');
    if (!acts) return;
    const foot = document.createElement('div');
    foot.className = 'sheet-foot';
    const del = sheet.querySelector('.btn-del') || sheet.querySelector('.resetlink');
    sheet.insertBefore(foot, acts);
    if (del) foot.appendChild(del);
    foot.appendChild(acts);
  }

  /* 繳費紀錄／老師異動歷史是會一直長的清單，不能跟固定欄位搶同一塊空間。
     把它們各自關進一個有上限、自己會捲的框，表單本身就永遠不用捲。
     順便在標籤後面標筆數，收起來也知道有幾筆。 */
  function boxHistory(sheet) {
    ['f-hist', 'f-tchlog'].forEach(cls => {
      const f = sheet.querySelector('.' + cls);
      if (!f || f.querySelector('.histbox')) return;
      const box = document.createElement('div');
      box.className = 'histbox';
      Array.prototype.slice.call(f.children).forEach(el => {
        if (el.tagName !== 'LABEL') box.appendChild(el);
      });
      f.appendChild(box);
      const n = box.querySelectorAll('.histrow').length;
      const label = f.querySelector('label');
      if (n && label && !/\d/.test(label.textContent)) label.textContent += '（' + n + '）';
    });
  }

  /* 面板要 540px 才排得下兩欄。算得出來不夠的話，先叫表格讓出兩欄。 */
  function fitPanel() {
    const app = document.getElementById('app');
    const side = document.getElementById('side');
    if (!app || !side || !side.querySelector('.overlay')) { app && app.classList.remove('narrow-edit'); return; }
    app.classList.remove('narrow-edit');
    if (side.getBoundingClientRect().width < 540) app.classList.add('narrow-edit');
  }

  ['renderStudentModal', 'renderRentalModal'].forEach(fn => {
    const orig = window[fn];
    if (typeof orig !== 'function') return;
    const host = fn === 'renderStudentModal' ? 'sov' : 'rov';
    window[fn] = function () {
      const r = orig.apply(this, arguments);
      fitPanel(); split(host); fitPanel();
      return r;
    };
  });

  const renderOrig = window.render;
  window.render = function () { const r = renderOrig.apply(this, arguments); fitPanel(); return r; };
  addEventListener('resize', fitPanel);
  setTimeout(() => { fitPanel(); split('sov'); split('rov'); fitPanel(); }, 1000);
})();
