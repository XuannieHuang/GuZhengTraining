/* modal-rental.js — 租借 modal（新增／編輯／續租／刪除＋歷史／還箏日） */
function openRental(id){
  document.body.classList.add('modal-open');
  const r = id ? DB.rentals.find(x=>x.id===id) : null;
  ui.rmodal = r ? Object.assign({},r,{isNew:false, logs:null, renewPay:today()})
                : { isNew:true, id:null, name:'', inst:'古箏', billing:'季繳', pay:today(), start:today(), due:dueFromStart(today(),'季繳'), status:'租賃中', returned:null, note:'' };
  renderRentalModal();
  if(id){ // 載入租借歷史
    sb.from('rental_logs').select('*').eq('rental_id', id).then(({data,error})=>{
      if(ui.rmodal && ui.rmodal.id===id){
        ui.rmodal.logs = error ? [] : (data||[]).sort((a,b)=>((b.start_date||b.pay_date||'')).localeCompare(a.start_date||a.pay_date||''));
        renderRentalModal();
      }
    });
  }
}
function renderRentalModal(){
  const m=ui.rmodal; if(!m) return;
  const esc=(v)=>String(v==null?'':v).replace(/"/g,'&quot;');
  const chips=(key,opts)=>opts.map(o=>`<div class="chipbtn ${m[key]===o?'sel':''}" onclick="rfield('${key}','${o}')">${o}</div>`).join('');
  let host=document.getElementById('rov'); if(!host){ host=document.createElement('div'); host.id='rov'; document.body.appendChild(host); }
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closeRental()">
    <div class="sheet">
      <div class="handle"></div>
      <h3>${m.isNew?'新增器材租借':'器材租借'}</h3>
      <div class="field"><label>承租人姓名</label><input class="inp" value="${esc(m.name)}" oninput="ui.rmodal.name=this.value" placeholder="輸入學生姓名"></div>
      <div class="field"><label>樂器</label><div class="chips">${chips('inst',['古箏','琵琶'])}</div></div>
      <div class="field"><label>方案</label><div class="chips">${chips('billing',['月繳','季繳'])}</div></div>
      <div class="field"><label>繳費日 <span class="sublabel">（可早繳／晚繳，與起租日無關）</span></label>
        <input class="inp" type="date" value="${m.pay||''}" onchange="ui.rmodal.pay=this.value"></div>
      <div class="field"><label>起租日</label>
        <input class="inp" type="date" value="${m.start||''}" onchange="ui.rmodal.start=this.value;ui.rmodal.due=dueFromStart(this.value,ui.rmodal.billing);renderRentalModal()"></div>
      <div class="field"><label>到期日 <span class="sublabel">（起租日自動帶 +${m.billing==='季繳'?3:1} 個月，可手動改）</span></label>
        <input class="inp" type="date" value="${m.due||''}" onchange="ui.rmodal.due=this.value"></div>
      <div class="field"><label>備註</label><input class="inp" value="${esc(m.note)}" oninput="ui.rmodal.note=this.value"></div>
      ${!m.isNew?`<div class="field"><label>狀態</label><div class="chips">${chips('status',['租賃中','已還箏'])}</div></div>`:''}
      ${!m.isNew && m.status==='已還箏'?`<div class="field"><label>還箏日</label>
        <input class="inp" type="date" value="${m.returned||today()}" onchange="ui.rmodal.returned=this.value"></div>`:''}
      ${!m.isNew?`<div class="field"><label>租借歷史</label>
        ${m.logs===null ? '<div class="meta">載入中…</div>'
          : (m.logs.length ? m.logs.map(l=>`<div class="histrow rent">
              <span class="t-muted nowrap">繳費 ${fmtDate(l.pay_date)}</span>
              <span>${fmtDate2(l.start_date)} ～ ${fmtDate2(l.due_date)}</span></div>`).join('')
            : '<div class="meta">尚無歷史</div>')}
      </div>`:''}
      ${!m.isNew && m.status==='租賃中'?`
        <div class="field"><label>續租繳費日 <span class="sublabel">（下一期的繳費日）</span></label>
          <input class="inp" type="date" value="${m.renewPay||today()}" onchange="ui.rmodal.renewPay=this.value"></div>
        <button class="btn ghost renew-btn" onclick="renewRental()">續租一期</button>`:''}
      <div class="actions">
        <button class="btn ghost" onclick="closeRental()">取消</button>
        <button class="btn primary" onclick="saveRental()">${m.isNew?'新增':'儲存'}</button>
      </div>
      ${!m.isNew?`<a class="resetlink danger" onclick="deleteRental()">🗑 刪除這筆紀錄（舊資料）</a>`:''}
    </div></div>`;
}
function rfield(k,v){
  ui.rmodal[k]=v;
  if(k==='billing') ui.rmodal.due=dueFromStart(ui.rmodal.start, v);
  if(k==='status' && v==='已還箏' && !ui.rmodal.returned) ui.rmodal.returned=today();
  renderRentalModal();
}
function closeRental(){ const h=document.getElementById('rov'); if(h) h.remove(); ui.rmodal=null; document.body.classList.remove('modal-open'); }
async function saveRental(){
  const m=ui.rmodal;
  if(!m.name || !m.name.trim()){ toast('請輸入承租人姓名'); return; }
  const stu=DB.students.find(s=>s.name===m.name.trim());
  const returned = m.status==='已還箏' ? (m.returned||today()) : null;
  const rec={ student_id: stu?stu.id:null, renter_name:m.name.trim(), instrument:m.inst, billing:m.billing,
    pay_date:m.pay||null, start_date:m.start||null, due_date:m.due||null, status:m.status||'租賃中', returned_date:returned, note:(m.note||'').trim()||null };
  if(m.isNew){
    const {data,error}=await sb.from('rentals').insert(rec).select().single();
    if(error){ toast('新增失敗：'+error.message); return; }
    DB.rentals.push(mapRental(data));
    sb.from('rental_logs').insert({ rental_id:data.id, billing:rec.billing, pay_date:rec.pay_date, start_date:rec.start_date, due_date:rec.due_date }).then(({error})=>{ if(error) toast('歷史記錄失敗：'+error.message); });
  } else {
    const oldStart = DB.rentals.find(x=>x.id===m.id)?.start || null;   // 舊起租日 → 定位對應的歷史列
    const {error}=await sb.from('rentals').update(rec).eq('id',m.id);
    if(error){ toast('儲存失敗：'+error.message); return; }
    Object.assign(DB.rentals.find(x=>x.id===m.id), mapRental(Object.assign({id:m.id},rec)));
    // 同步更新租借歷史（rental_logs）當期那一列，避免歷史繳費日/租期與現況不一致
    if(oldStart){
      sb.from('rental_logs').update({ billing:rec.billing, pay_date:rec.pay_date, start_date:rec.start_date, due_date:rec.due_date })
        .eq('rental_id',m.id).eq('start_date',oldStart).then(({error})=>{ if(error) toast('歷史同步失敗：'+error.message); });
    }
  }
  const created=m.isNew; closeRental(); render(); toast(created?'已新增租借':'已更新');
}
async function renewRental(){
  const m=ui.rmodal;
  const payDate=m.renewPay||today();                   // 續租繳費日（可選）
  const newStart=m.due||today();                       // 新一期從上一期到期日接續
  const newDue=addMonths(newStart, m.billing==='季繳'?3:1);
  const {error}=await sb.from('rentals').update({pay_date:payDate, start_date:newStart, due_date:newDue}).eq('id',m.id);
  if(error){ toast('儲存失敗：'+error.message); return; }
  const r=DB.rentals.find(x=>x.id===m.id); r.pay=payDate; r.start=newStart; r.due=newDue;
  sb.from('rental_logs').insert({ rental_id:m.id, billing:m.billing, pay_date:payDate, start_date:newStart, due_date:newDue }).then(({error})=>{ if(error) toast('歷史記錄失敗：'+error.message); });
  closeRental(); render(); toast('已續租一期，起租日／到期日已更新');
}
async function deleteRental(){
  const m=ui.rmodal; if(!m||m.isNew) return;
  if(!confirm(`確定刪除「${m.name}」這筆租借紀錄？此動作無法復原。`)) return;
  const {error}=await sb.from('rentals').delete().eq('id',m.id);
  if(error){ toast('刪除失敗：'+error.message); return; }
  DB.rentals = DB.rentals.filter(x=>x.id!==m.id);
  closeRental(); render(); toast('已刪除租借紀錄');
}
