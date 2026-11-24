/* modal-book.js — 課本管理 modal（新增／編輯／進貨／紀錄）
 *
 * 版面沿用學生 modal 那一套：
 *   標題即課本名稱（可直接改），桌機分三頁 基本資料／記一筆進貨／紀錄。
 *
 * 數量只有一個真相來源：books.qty 永遠等於 book_moves 最後一筆的 qty_after。
 * 所以「數量」在基本資料裡是唯讀的 —— 要改只能走進貨（這一版）或盤點（第 2 期）。
 */
function openBook(id){
  const b = id ? DB.books.find(x=>x.id===id) : null;
  ui.bmodal = b ? Object.assign({}, b, { isNew:false, moves:null })
                : { isNew:true, id:null, name:'', price:null, qty:0, loc:'', photo:'', note:'', moves:[] };
  document.body.classList.add('modal-open');
  renderBookModal();
  if(id){
    sb.from('book_moves').select('*').eq('book_id', id).then(({data,error})=>{
      if(ui.bmodal && ui.bmodal.id===id){
        ui.bmodal.moves = error ? [] : (data||[]).sort((a,b)=>
          (b.move_date||'').localeCompare(a.move_date||'') || (b.created_at||'').localeCompare(a.created_at||''));
        renderBookModal();
      }
    });
  }
}

/* 存放區域：自由打字，但把已經用過的區域列出來讓你點 ——
   不另開區域主檔表，又不會打成「櫃子A」「櫃A」「A櫃」三種。
   （跟租借的承租人建議清單同一個做法） */
function bookLocs(){
  return [...new Set(DB.books.map(b=>b.loc).filter(Boolean))].sort();
}
function locSug(){
  const m=ui.bmodal, q=(m.loc||'').trim();
  const all = bookLocs();
  // 打字到一半 → 只列相符的；已經填好一個既有區域 → 列出其他區域讓你改。
  // 不分這兩種情況的話，填好之後建議清單會整個變空。
  const exact = all.includes(q);
  const hit = all.filter(l=>l!==q && (exact || !q || l.includes(q))).slice(0,6);
  if(!hit.length) return '';
  return `<div class="rsug">${hit.map(l=>
    `<button type="button" class="rsug-i" onclick="bfield('loc','${l.replace(/'/g,"\\'")}')">${l}</button>`).join('')}</div>`;
}

function renderBookModal(){
  const m=ui.bmodal; if(!m) return;
  const host=modalHost('bov');
  const esc=(v)=>String(v==null?'':v).replace(/"/g,'&quot;');
  const htmlesc=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const tabbed = (typeof isDesk==='function') && isDesk() && !m.isNew;
  if(tabbed && !m.pane) m.pane='data';
  const pane=(k)=> !tabbed || m.pane===k;

  if(!m.stockForm) m.stockForm = { n:1, date:today(), note:'' };
  const sf=m.stockForm;
  const stockFields=`
      <div class="field f-att"><label>進幾本</label>
        <input class="inp" type="number" inputmode="numeric" value="${sf.n}"
               oninput="ui.bmodal.stockForm.n=parseInt(this.value||'0',10);bStockTotal()"></div>
      <div class="field f-date"><label>進貨日</label>
        <input class="inp" type="date" value="${sf.date}" onchange="ui.bmodal.stockForm.date=this.value"></div>
      <div class="field f-note"><label>備註</label>
        <input class="inp" value="${esc(sf.note)}" oninput="ui.bmodal.stockForm.note=this.value"></div>
      <div class="summary"><span>進貨後數量</span><b id="b-total">${(m.qty||0)+(sf.n||0)}</b></div>`;

  let stockBox='';
  if(m.isNew){
    // 新增時填的數量就是第一筆進貨（跟「新增學生一併登記首期繳費」同一個模式）
    stockBox=`<div class="field f-att"><label>數量</label>
        <input class="inp" type="number" inputmode="numeric" value="${m.qty||0}"
               oninput="ui.bmodal.qty=parseInt(this.value||'0',10)">
        <div class="fieldhint">建檔時的現有本數，會記成第一筆進貨</div></div>`;
  }else if(tabbed){
    stockBox=`<div class="field paybox">${stockFields}
        <button class="btn primary block paybtn" onclick="stockIn()">確認進貨</button></div>`;
  }else{
    stockBox=`<div class="field paybox">
        <label class="paytoggle"><input type="checkbox" ${m.stockOn?'checked':''} onchange="toggleStockBox(this.checked)"> 📦 記一筆進貨</label>
        ${m.stockOn?`${stockFields}
        <button class="btn primary block paybtn" onclick="stockIn()">確認進貨</button>`:''}
      </div>`;
  }

  const movesHtml = m.moves===null ? '<div class="meta">載入中…</div>'
    : (m.moves.length ? m.moves.map(v=>{
        const d=(v.qty_after||0)-(v.qty_before||0);
        return `<div class="histrow pay">
          <span class="hleft"><span class="hdate">${fmtDate2(v.move_date)}</span>
            <span class="t-muted">${v.kind}${v.note?' · '+htmlesc(v.note):''}</span></span>
          <b class="${d<0?'t-red':'t-primary'}">${d>0?'+':''}${d}</b></div>`;
      }).join('')
      : '<div class="meta">尚無異動紀錄</div>');

  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closeBook()">
    <div class="sheet">
      <div class="handle"></div>
      <h3><span class="sheet-ttl">
        <span class="t"><input class="ttl-inp" value="${esc(m.name)}" placeholder="課本名稱" oninput="ui.bmodal.name=this.value"></span>
        <span class="s">${m.isNew?'新增課本':'編輯課本'}</span>
      </span><span class="sheet-acts"><button class="sheet-x" onclick="closeBook()" title="關閉" aria-label="關閉">✕</button></span></h3>
      ${tabbed?`<div class="sheet-tabs">
        <button class="${m.pane==='data'?'on':''}" onclick="bPane('data')">基本資料</button>
        <button class="${m.pane==='stock'?'on':''}" onclick="bPane('stock')">記一筆進貨</button>
        <button class="${m.pane==='log'?'on':''}" onclick="bPane('log')">紀錄${
          (m.moves&&m.moves.length)?`<span class="n">${m.moves.length}</span>`:''}</button>
      </div>`:''}
      ${pane('data')?`
      <div class="field f-amt"><label>售價</label>
        <input class="inp" type="number" inputmode="numeric" value="${m.price==null?'':m.price}"
               oninput="ui.bmodal.price=this.value===''?null:parseInt(this.value,10)"></div>
      <div class="field f-loc"><label>存放區域</label>
        <input class="inp" value="${esc(m.loc)}" oninput="ui.bmodal.loc=this.value" placeholder="例如 教室一 · 書櫃 A">
        <div id="blocsug">${locSug()}</div></div>
      <div class="field f-photo"><label>封面</label>
        <div class="bphoto">${bookThumb(m,'big')}
          <label class="bphoto-btn">${m.photo?'換一張':'拍照／選檔'}
            <input type="file" accept="image/*" capture="environment" onchange="pickBookPhoto(this)"></label>
          ${m.photo?`<button class="bphoto-del" onclick="bfield('photo','')">移除</button>`:''}
        </div></div>
      ${m.isNew?'':`<div class="field f-att"><label>數量</label><div class="bqty">${m.qty||0}</div>
        <div class="fieldhint">數量只能用進貨修改，這裡不直接改</div></div>`}
      <div class="field f-note"><label>備註</label><textarea class="inp note-area" rows="2"
        oninput="ui.bmodal.note=this.value">${htmlesc(m.note)}</textarea></div>
      `:''}
      ${pane('stock')?stockBox:''}
      ${(m.isNew||!pane('log'))?'':`<div class="field f-hist"><label>紀錄</label>${movesHtml}</div>`}
      ${(m.isNew||!pane('data'))?'':`<div class="dz"><button class="dz-link" onclick="deleteBook()">刪除課本</button></div>`}
      <div class="actions">
        <button class="btn ghost" onclick="closeBook()">取消</button>
        <button class="btn primary" onclick="saveBook()">${m.isNew?'新增':'儲存'}</button>
      </div>
    </div></div>`;
}

function bfield(k,v){ ui.bmodal[k]=v; renderBookModal(); }
function bPane(v){ const m=ui.bmodal; if(!m) return; m.pane=v; renderBookModal(); }
function toggleStockBox(on){
  ui.bmodal.stockOn=on; renderBookModal();
  if(on){ const b=document.querySelector('#bov .paybox'); if(b) b.scrollIntoView({block:'nearest'}); }
}
/* 只換合計那個數字，不重繪整張表單（免得打字到一半被打斷） */
function bStockTotal(){
  const m=ui.bmodal, el=document.getElementById('b-total');
  if(el) el.textContent=(m.qty||0)+(m.stockForm.n||0);
}
function closeBook(){
  const h=document.getElementById('bov'); if(h) h.remove();
  ui.bmodal=null; document.body.classList.remove('modal-open'); render();
}

async function pickBookPhoto(input){
  const f=input.files && input.files[0]; if(!f) return;
  toast('上傳中…');
  try{
    const path=await uploadBookPhoto(f);
    await loadBookPhotos([path]);
    ui.bmodal.photo=path; renderBookModal(); toast('封面已更新');
  }catch(e){ toast('上傳失敗：'+(e.message||e)); }
}

/* 記一筆進貨：寫流水 ＋ 更新數量，兩邊一致 */
async function stockIn(){
  const m=ui.bmodal, f=m.stockForm;
  const n=f.n||0;
  if(!n){ toast('請輸入進貨本數'); return; }
  const before=m.qty||0, after=before+n;
  const { error }=await sb.from('book_moves').insert({
    book_id:m.id, kind:'進貨', move_date:f.date, qty_before:before, qty_after:after,
    note:(f.note||'').trim()||null });
  if(error){ toast('進貨失敗：'+error.message); return; }
  const { error:e2 }=await sb.from('books').update({ qty:after }).eq('id', m.id);
  if(e2){ toast('數量更新失敗：'+e2.message); return; }
  m.qty=after;
  const b=DB.books.find(x=>x.id===m.id); if(b) b.qty=after;
  m.stockForm=null; m.stockOn=false;
  toast(`已進貨 ${n} 本　數量 ${before} → ${after}`);
  sb.from('book_moves').select('*').eq('book_id',m.id).then(({data})=>{
    if(ui.bmodal&&ui.bmodal.id===m.id){
      ui.bmodal.moves=(data||[]).sort((a,b)=>(b.move_date||'').localeCompare(a.move_date||'')||(b.created_at||'').localeCompare(a.created_at||''));
      renderBookModal();
    }});
  renderBookModal();
}

async function saveBook(){
  const m=ui.bmodal;
  if(!m.name || !m.name.trim()){ toast('請輸入課本名稱'); return; }
  const rec={ name:m.name.trim(), price:m.price==null?null:m.price,
    location:(m.loc||'').trim()||null, photo_path:m.photo||null,
    note:(m.note||'').trim()||null };
  if(m.isNew){
    rec.qty=m.qty||0;
    const { data, error }=await sb.from('books').insert(rec).select().single();
    if(error){ toast('新增失敗：'+error.message); return; }
    DB.books.push(mapBook(data));
    // 建檔的數量＝第一筆進貨，數量的來龍去脈才完整
    if(rec.qty){
      const { error:merr } = await sb.from('book_moves').insert({ book_id:data.id, kind:'進貨',
        move_date:today(), qty_before:0, qty_after:rec.qty, note:'建檔初始數量' });
      if(merr) toast('課本已新增，但初始數量沒記進紀錄：'+merr.message);
    }
  }else{
    const { error }=await sb.from('books').update(rec).eq('id',m.id);   // 不更新 qty
    if(error){ toast('儲存失敗：'+error.message); return; }
    const b=DB.books.find(x=>x.id===m.id);
    if(b) Object.assign(b,{ name:rec.name, price:rec.price, loc:rec.location||'',
      photo:rec.photo_path||'', note:rec.note||'' });
  }
  const created=m.isNew;
  closeBook();
  toast(created?'已新增課本':'已更新課本');
}

/* 刪除＝註記刪除。異動紀錄與封面檔案全部保留，跟學生的刪除一致。 */
async function deleteBook(){
  const m=ui.bmodal; if(!m||m.isNew) return;
  const n=(m.moves||[]).length;
  if(!confirm(`確定刪除課本「${m.name}」？\n\n`
    + (n?`・異動紀錄 ${n} 筆　保留\n`:'')
    + '・封面圖片　保留\n\n刪除後不再出現在 App 裡，無法在 App 內還原。')) return;
  const { error }=await sb.from('books').update({ deleted_at:new Date().toISOString() }).eq('id',m.id);
  if(error){ toast('刪除失敗：'+error.message); return; }
  DB.books=DB.books.filter(x=>x.id!==m.id);
  closeBook(); toast(`已刪除課本 ${m.name}`);
}
