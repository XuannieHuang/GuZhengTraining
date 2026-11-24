/* view-stocktake.js — 課本盤點
 *
 * 不在導覽裡，從設定頁的「📋 盤點」進來（跟事件修正從報表進來同一個模式）。
 *
 * 一本書常常分散在好幾個地方，所以盤點是**一區一區走**：
 *   上方三個分頁（書架／右教室／左教室），在哪一區就填哪一區點到的本數，
 *   系統自動加總。最後存進系統的是**總數**，不記各區各幾本 ——
 *   分區純粹是動線，免得點完書架就以為點完了。
 *
 * 每一列同時顯示「合計 / 帳面 / 差異」，所以站在第二區就看得出來還差幾本。
 * 按「完成盤點」才一次寫入；中途離開完全不算。
 */
function openStocktake(){
  ui.screen = 'stocktake';
  ui.stock = { date: today(), area: BOOK_AREAS[0], counts: {}, done: {} };
  DB.books.forEach(b=>{
    ui.stock.counts[b.id] = {};
    BOOK_AREAS.forEach(a=>{ ui.stock.counts[b.id][a] = 0; });
  });
  loadBookPhotos().then(render);
  render();
}

function stockAt(id, area){
  const c = ui.stock && ui.stock.counts[id];
  return c && c[area] != null ? c[area] : 0;
}
function stockTotal(id){
  return BOOK_AREAS.reduce((n,a)=>n+stockAt(id,a), 0);
}
function stockDiff(b){ return stockTotal(b.id) - (b.qty||0); }
function stockChanged(){ return DB.books.filter(b=>stockDiff(b) !== 0); }
/* 完全沒點到、但帳面有數量的 —— 多半是漏了某一區沒走到，不是真的歸零 */
function stockMissed(){ return DB.books.filter(b=>(b.qty||0) > 0 && stockTotal(b.id) === 0); }

function setStockAt(id, area, v){
  const n = parseInt(v || '0', 10);
  ui.stock.counts[id][area] = isNaN(n) ? 0 : n;
  const body = document.getElementById('stbody');
  if(body){ body.innerHTML = stocktakeBody(); bindStock(); }
  const btn = document.getElementById('st-done');
  if(btn) btn.textContent = stockDoneLabel();
}
function setStockArea(a){ ui.stock.area = a; render(); }
function toggleAreaDone(a){ ui.stock.done[a] = !ui.stock.done[a]; render(); }
function stockDoneLabel(){
  const n = stockChanged().length;
  return n ? `完成盤點 · ${n} 本有差異` : '完成盤點';
}

function stockRowHtml(b){
  const area = ui.stock.area, total = stockTotal(b.id), d = total - (b.qty||0);
  // 還沒點到的（合計 0）不標黃 —— 那是「還沒走到」不是「有差異」，
  // 一進來整頁都是黃的反而看不出重點。真的漏點由「完成盤點」時的警告擋。
  const flag = total > 0 && d !== 0;
  return `<div class="st-row ${flag?'diff':''}" data-id="${b.id}">
    ${bookThumb(b)}
    <div class="grow"><div class="name">${b.name}</div></div>
    <input class="num" type="number" inputmode="numeric" value="${stockAt(b.id, area)}"
           data-act="stnum" data-id="${b.id}">
    <div class="st-sum"><span class="st-t">合計 <b>${total}</b></span><span class="st-book">帳面 ${b.qty||0}</span></div>
    <div class="st-diff ${d<0?'t-red':(d>0?'t-primary':'t-muted')}">${d===0?'—':(d>0?'+'+d:d)}</div>
  </div>`;
}

function stocktakeBody(){
  if(!DB.books.length) return `<div class="empty">尚未建立課本</div>`;
  const list = DB.books.slice().sort(byBookSort);
  return `<div class="chk-card">${list.map(stockRowHtml).join('')}</div>`;
}

function stocktakeView(){
  const tabs = BOOK_AREAS.map(a=>
    `<div class="tab ${ui.stock.area===a?'active':''}" onclick="setStockArea('${a}')">${
      ui.stock.done[a]?'✓ ':''}${a}</div>`).join('');
  const area = ui.stock.area;
  return `<div class="ev-top">
      <button class="ev-back" onclick="go('setting')">‹ 返回設定</button>
    </div>
    <div class="st-bar">
      <label class="st-date">盤點日
        <input class="inp" type="date" value="${ui.stock.date}" onchange="ui.stock.date=this.value"></label>
      <button class="btn primary st-done" id="st-done" onclick="finishStocktake()">${stockDoneLabel()}</button>
    </div>
    <div class="tabsrow"><div class="tabs">${tabs}</div></div>
    <label class="st-doneflag"><input type="checkbox" ${ui.stock.done[area]?'checked':''}
      onchange="toggleAreaDone('${area}')"> ${area}點完了</label>
    <div id="stbody">${stocktakeBody()}</div>`;
}

function bindStock(){
  const area = ui.stock.area;
  document.querySelectorAll('[data-act="stnum"]').forEach(el=>{
    el.onchange = ()=> setStockAt(el.getAttribute('data-id'), area, el.value);
    el.onfocus  = ()=> el.select();
  });
}

/* 完成盤點：先寫流水（一次送出、原子性），再更新有差異的數量。
   流水先寫，是因為萬一數量更新失敗，至少紀錄上查得到應該是多少。 */
async function finishStocktake(){
  const changed = stockChanged(), missed = stockMissed();
  const notDone = BOOK_AREAS.filter(a=>!ui.stock.done[a]);

  let msg = '';
  if(notDone.length) msg += `還沒標記點完的區域：${notDone.join('、')}\n\n`;
  if(missed.length)
    msg += `這 ${missed.length} 本完全沒點到，完成後會變成 0：\n`
         + missed.slice(0,6).map(b=>`・${b.name}（帳面 ${b.qty}）`).join('\n')
         + (missed.length>6?`\n…等 ${missed.length} 本`:'') + '\n\n';
  msg += changed.length
    ? `有 ${changed.length} 本數量不一樣：\n`
      + changed.slice(0,8).map(b=>`・${b.name}　${b.qty} → ${stockTotal(b.id)}`).join('\n')
      + (changed.length>8?`\n…等 ${changed.length} 本`:'') + '\n\n確定完成盤點嗎？'
    : '這次盤點沒有任何差異，仍要記錄一次嗎？';
  if(!confirm(msg)) return;

  const rows = DB.books.map(b=>{
    // 各區的數字只留在紀錄的備註裡當線索，不另外存成庫存
    const parts = BOOK_AREAS.filter(a=>stockAt(b.id,a)).map(a=>`${a} ${stockAt(b.id,a)}`);
    return { book_id:b.id, kind:'盤點', move_date:ui.stock.date,
      qty_before:b.qty||0, qty_after:stockTotal(b.id), note:parts.join(' · ')||null };
  });
  const { error } = await sb.from('book_moves').insert(rows);
  if(error){ toast('盤點寫入失敗：'+error.message); return; }

  const fail = [];
  for(const b of changed){
    const n = stockTotal(b.id);
    const { error:e2 } = await sb.from('books').update({ qty:n }).eq('id', b.id);
    if(e2) fail.push(b.name); else b.qty = n;
  }
  REPORTS.lastCount = ui.stock.date;
  ui.stock = null;
  go('setting');
  if(fail.length) toast('這幾本的數量沒更新成功，請重新盤點：'+fail.join('、'));
  else toast(changed.length ? `盤點完成　${changed.length} 本有差異` : '盤點完成　沒有差異');
}
