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
/* 承租人＝學生名單挑選：存進資料庫的一律是「系統記的姓名」，不是當下打的字。
   避免租借與學生斷鏈（差一個字就連不上，畫面又看不出來）。 */
function renterInput(v){
  ui.rmodal.name=v; ui.rmodal.sid=null;              // 手動改字就先解除連結
  // 只換輸入框以外的區塊（注音組字才不會被打斷）
  const box=document.getElementById('rsug');   if(box) box.innerHTML=renterSug();
  const tch=document.getElementById('rtch');   if(tch) tch.innerHTML=renterTeacherRow();
}
function pickRenter(id){
  const s=DB.students.find(x=>x.id===id); if(!s) return;
  ui.rmodal.sid=s.id; ui.rmodal.name=s.name;          // 以系統記的名稱為主
  renderRentalModal();
}
function renterTeacherRow(){
  const tn=rentalTeacher(ui.rmodal);
  return tn?`<div class="field tchrow"><label>老師 <span class="sublabel">（自動帶出）</span></label><div class="tchval">${tn}</div></div>`:'';
}
function renterSug(){
  const m=ui.rmodal, q=(m.name||'').trim();
  if(m.sid){
    const s=DB.students.find(x=>x.id===m.sid);
    return s?`<div class="rlink ok">已連結學生：${s.name}${teacherName(s.t)?' · '+teacherName(s.t):''}</div>`:'';
  }
  if(!q) return '';
  const hit=DB.students.filter(s=>s.name&&s.name.includes(q)).slice(0,6);
  if(!hit.length) return `<div class="rlink warn">系統沒有這個人，將記為非學生承租人</div>`;
  return `<div class="rsug">${hit.map(s=>`<button type="button" class="rsug-i" onclick="pickRenter('${s.id}')">${s.name}<span>${s.status||''}${teacherName(s.t)?' · '+teacherName(s.t):''}</span></button>`).join('')}</div>`;
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
      <div class="field"><label>承租人姓名</label>
        <input class="inp" value="${esc(m.name)}" oninput="renterInput(this.value)" oncompositionend="renterInput(this.value)" placeholder="輸入學生姓名">
        <div id="rsug">${renterSug()}</div></div>
      <div id="rtch">${renterTeacherRow()}</div>
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
      ${!m.isNew?`<div class="field"><label>租借歷史 <span class="sublabel">（每期一筆；✕ 可刪該期）</span></label>
        ${m.logs===null ? '<div class="meta">載入中…</div>'
          : (m.logs.length ? m.logs.map((l,i)=>`<div class="histrow rent">
              <span class="t-muted nowrap">繳費 ${fmtDate(l.pay_date)}</span>
              <span>${fmtDate2(l.start_date)} ～ ${fmtDate2(l.due_date)}</span>
              <button class="logdel" onclick="deleteRentalLog('${l.id}')" title="刪除這一期">✕</button></div>`).join('')
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
  // 優先用明確挑選的學生；沒挑就退回完全同名比對（沿用舊行為）
  const stu=(m.sid?DB.students.find(s=>s.id===m.sid):null)||DB.students.find(s=>s.name===m.name.trim());
  const returned = m.status==='已還箏' ? (m.returned||today()) : null;
  // renter_name 以系統記的名稱為主（挑到學生就用學生的寫法）
  const rec={ student_id: stu?stu.id:null, renter_name: stu?stu.name:m.name.trim(), instrument:m.inst, billing:m.billing,
    pay_date:m.pay||null, start_date:m.start||null, due_date:m.due||null, status:m.status||'租賃中', returned_date:returned, note:(m.note||'').trim()||null };
  // 防重複：同一人（以連到的學生為準，沒連就比姓名）已有同樂器的租賃中紀錄
  if(m.isNew){
    const dup=DB.rentals.filter(r=>r.status==='租賃中' && r.inst===rec.instrument
      && (stu ? (r.sid===stu.id || r.name===stu.name) : r.name===rec.renter_name));
    if(dup.length){
      const d=dup[0];
      if(!confirm(`${rec.renter_name} 已有一筆租賃中的${rec.instrument}\n（${fmtDate2(d.start)} ～ ${fmtDate2(d.due)}）\n\n要延長租期請用那筆的「續租一期」。\n確定還要新增一筆嗎？`)) return;
    }
  }

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
async function deleteRentalLog(logId){
  const m=ui.rmodal; const logs=m.logs||[];
  const log=logs.find(l=>l.id===logId); if(!log) return;
  const isLatest = logs.length && logs[0].id===logId;   // logs 依 start_date 由新到舊，[0] 即當期
  if(!confirm(isLatest && logs.length>1
      ? `刪除這一期（${fmtDate2(log.start_date)}～${fmtDate2(log.due_date)}）？\n這是最新一期，租期會回到上一期。`
      : `刪除這一期繳費紀錄（${fmtDate2(log.start_date)}～${fmtDate2(log.due_date)}）？`)) return;
  const { error } = await sb.from('rental_logs').delete().eq('id',logId);
  if(error){ toast('刪除失敗：'+error.message); return; }
  // 刪的是當期且還有其他期 → 租借現況回到上一期
  if(isLatest && logs.length>1){
    const prev=logs[1];
    const rec={ pay_date:prev.pay_date, start_date:prev.start_date, due_date:prev.due_date, billing:prev.billing||m.billing };
    const { error:e2 } = await sb.from('rentals').update(rec).eq('id',m.id);
    if(e2){ toast('回復上一期失敗：'+e2.message); }
    const r=DB.rentals.find(x=>x.id===m.id); if(r) Object.assign(r,{ pay:prev.pay_date, start:prev.start_date, due:prev.due_date, billing:rec.billing });
    Object.assign(m,{ pay:prev.pay_date, start:prev.start_date, due:prev.due_date, billing:rec.billing });
  }
  m.logs = logs.filter(l=>l.id!==logId);
  renderRentalModal(); render();
  toast('已刪除該期');
}
async function deleteRental(){
  const m=ui.rmodal; if(!m||m.isNew) return;
  if(!confirm(`確定刪除「${m.name}」這筆租借紀錄？此動作無法復原。`)) return;
  const {error}=await sb.from('rentals').delete().eq('id',m.id);
  if(error){ toast('刪除失敗：'+error.message); return; }
  DB.rentals = DB.rentals.filter(x=>x.id!==m.id);
  closeRental(); render(); toast('已刪除租借紀錄');
}
