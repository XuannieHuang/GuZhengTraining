/* view-stocktake.js — 課本盤點
 *
 * 不在導覽裡，從設定頁的「📋 盤點」進來（跟事件修正從報表進來同一個模式）。
 *
 * 盤點是「把系統數量校正成實際本數」，所以：
 *   - 依存放區域分組 —— 你走到哪一櫃就點哪一櫃，不用在整份清單裡來回找
 *   - 每一列有封面縮圖 —— 一本本對照著點，不會點錯書
 *   - 「實際」預設帶入帳面，只改有差的那幾本
 *   - 按「完成盤點」才一次寫入；中途離開完全不算，不會寫半套
 */
function openStocktake(){
  ui.screen = 'stocktake';
  // 每次進來重新開一份，不接續上次沒完成的
  ui.stock = { date: today(), counts: {} };
  DB.books.forEach(b => { ui.stock.counts[b.id] = b.qty || 0; });
  loadBookPhotos().then(render);
  render();
}
function stockCount(id){
  const c = ui.stock && ui.stock.counts;
  return c && c[id] != null ? c[id] : 0;
}
function stockDiff(b){ return stockCount(b.id) - (b.qty || 0); }
function stockChanged(){ return DB.books.filter(b => stockDiff(b) !== 0); }

function setStockCount(id, v){
  const n = parseInt(v || '0', 10);
  ui.stock.counts[id] = isNaN(n) ? 0 : n;
  // 只重繪清單，不動輸入框本身（避免打字被打斷）
  const body = document.getElementById('stbody');
  if(body){ body.innerHTML = stocktakeBody(); bindStock(); }
  const btn = document.getElementById('st-done');
  if(btn) btn.textContent = stockDoneLabel();
}
function stockDoneLabel(){
  const n = stockChanged().length;
  return n ? `完成盤點 · ${n} 本有差異` : '完成盤點';
}

/* 一列：縮圖、名稱、售價、帳面、實際、差異 */
function stockRowHtml(b){
  const d = stockDiff(b);
  return `<div class="st-row ${d?'diff':''}" data-id="${b.id}">
    ${bookThumb(b)}
    <div class="grow"><div class="name">${b.name}</div>
      <div class="meta">${b.price!=null?'$'+b.price.toLocaleString():''}</div></div>
    <div class="st-book">帳面 <b>${b.qty||0}</b></div>
    <input class="num" type="number" inputmode="numeric" value="${stockCount(b.id)}"
           data-act="stnum" data-id="${b.id}">
    <div class="st-diff ${d<0?'t-red':(d>0?'t-primary':'t-muted')}">${d===0?'—':(d>0?'+'+d:d)}</div>
  </div>`;
}

function stocktakeBody(){
  if(!DB.books.length) return `<div class="empty">尚未建立課本</div>`;
  const list = DB.books.slice().sort((a,b)=>
    (a.loc||'￿').localeCompare(b.loc||'￿') || a.name.localeCompare(b.name));
  let html='', cur=null;
  list.forEach(b=>{
    const loc = b.loc || '未分區';
    if(loc!==cur){ cur=loc;
      html += `<div class="check-group">${loc} · ${list.filter(x=>(x.loc||'未分區')===loc).length} 本</div>`; }
    html += stockRowHtml(b);
  });
  return `<div class="chk-card">${html}</div>`;
}

function stocktakeView(){
  return `<div class="ev-top">
      <button class="ev-back" onclick="go('setting')">‹ 返回設定</button>
    </div>
    <div class="st-bar">
      <label class="st-date">盤點日
        <input class="inp" type="date" value="${ui.stock.date}" onchange="ui.stock.date=this.value"></label>
      <button class="btn primary st-done" id="st-done" onclick="finishStocktake()">${stockDoneLabel()}</button>
    </div>
    <div id="stbody">${stocktakeBody()}</div>`;
}

/* 數字欄位用事件綁定，不用 inline onchange —— 跟核對頁同一套 */
function bindStock(){
  document.querySelectorAll('[data-act="stnum"]').forEach(el=>{
    el.onchange = ()=> setStockCount(el.getAttribute('data-id'), el.value);
    el.onfocus  = ()=> el.select();
  });
}

/* 完成盤點：先寫流水（一次送出、原子性），再更新有差異的數量。
   流水先寫，是因為萬一數量更新失敗，至少紀錄上查得到應該是多少。 */
async function finishStocktake(){
  const changed = stockChanged();
  const msg = changed.length
    ? `有 ${changed.length} 本數量不一樣，確定完成盤點嗎？\n\n`
      + changed.slice(0,8).map(b=>`・${b.name}　${b.qty} → ${stockCount(b.id)}`).join('\n')
      + (changed.length>8 ? `\n…等 ${changed.length} 本` : '')
    : '這次盤點沒有任何差異，仍要記錄一次嗎？';
  if(!confirm(msg)) return;

  const rows = DB.books.map(b=>({
    book_id:b.id, kind:'盤點', move_date:ui.stock.date,
    qty_before:b.qty||0, qty_after:stockCount(b.id), note:null }));
  const { error } = await sb.from('book_moves').insert(rows);
  if(error){ toast('盤點寫入失敗：'+error.message); return; }

  const fail = [];
  for(const b of changed){
    const n = stockCount(b.id);
    const { error:e2 } = await sb.from('books').update({ qty:n }).eq('id', b.id);
    if(e2) fail.push(b.name); else b.qty = n;
  }
  REPORTS.lastCount = ui.stock.date;          // 報表那張卡立刻跟上
  ui.stock = null;
  go('setting');
  if(fail.length) toast('這幾本的數量沒更新成功，請重新盤點：'+fail.join('、'));
  else toast(changed.length ? `盤點完成　${changed.length} 本有差異` : '盤點完成　沒有差異');
}
