/* modal-payevent.js — 編輯單筆繳費事件（改／刪／退費），同步報表與學生歷史 */
function findPayment(id){
  let p=(REPORTS.payments||[]).find(x=>x.id===id);
  if(!p && ui.smodal && ui.smodal.history) p=ui.smodal.history.find(x=>x.id===id);
  return p;
}
function openPayEvent(id){
  const p=findPayment(id); if(!p){ toast('找不到這筆繳費紀錄'); return; }
  const s=DB.students.find(x=>x.id===p.student_id);
  ui.pemodal={ id:p.id, sid:p.student_id, sname:s?s.name:'（學生已刪除）',
    billing:p.billing||'月繳', periods:p.periods||1, amount:p.amount||0, date:p.pay_date||today() };
  document.body.classList.add('modal-open'); renderPayEvent();
}
function renderPayEvent(){
  const m=ui.pemodal; if(!m) return;
  let host=document.getElementById('peov'); if(!host){ host=document.createElement('div'); host.id='peov'; document.body.appendChild(host); }
  const planOpts=['月繳','季繳','單堂'];
  const total=m.amount*m.periods;
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closePayEvent()">
    <div class="sheet">
      <div class="handle"></div>
      <h3>${m.sname}　編輯繳費</h3>
      <div class="sub-h">修正這筆繳費紀錄（補登／改錯／退費）· 不影響已上堂數</div>
      <div class="field"><label>方案</label><div class="chips">
        ${planOpts.map(p=>`<div class="chipbtn ${m.billing===p?'sel':''}" onclick="peField('billing','${p}')">${p}</div>`).join('')}
      </div></div>
      <div class="field"><label>期數</label><div class="chips">
        ${[1,2,3].map(n=>`<div class="chipbtn ${m.periods===n?'sel':''}" onclick="peField('periods',${n})">${n} 期</div>`).join('')}
      </div></div>
      <div class="field"><label>金額／期 <span class="sublabel">（退費可填負數）</span></label>
        <input class="inp" type="number" inputmode="numeric" value="${m.amount}" oninput="ui.pemodal.amount=parseInt(this.value||'0',10);peTotal()"></div>
      <div class="field"><label>繳費日</label>
        <input class="inp" type="date" value="${m.date}" onchange="ui.pemodal.date=this.value"></div>
      <div class="summary"><span>合計（${m.periods} 期）</span><b id="pe-total" class="${total<0?'t-red':''}">$${total.toLocaleString()}</b></div>
      <div class="actions">
        <button class="btn ghost" onclick="closePayEvent()">取消</button>
        <button class="btn primary" onclick="savePayEvent()">儲存</button>
      </div>
      <button class="btn ghost block" onclick="refundPayEvent()">↩ 退費（另記一筆負數）</button>
      <a class="resetlink danger" onclick="deletePayEvent()">🗑 刪除這筆繳費</a>
    </div></div>`;
}
function peField(k,v){ ui.pemodal[k]=v; renderPayEvent(); }
function peTotal(){ const m=ui.pemodal, el=document.getElementById('pe-total'); if(el){ const t=m.amount*m.periods; el.textContent='$'+t.toLocaleString(); el.classList.toggle('t-red',t<0); } }
function closePayEvent(){ const h=document.getElementById('peov'); if(h) h.remove(); ui.pemodal=null; if(!ui.smodal) document.body.classList.remove('modal-open'); }

async function savePayEvent(){
  const m=ui.pemodal;
  const rec={ billing:m.billing, periods:m.periods, amount:m.amount, pay_date:m.date };
  const { error } = await sb.from('payments').update(rec).eq('id',m.id);
  if(error){ toast('儲存失敗：'+error.message); return; }
  const p=findPayment(m.id); if(p) Object.assign(p, { billing:rec.billing, periods:rec.periods, amount:rec.amount, pay_date:rec.pay_date });
  closePayEvent(); refreshAfterPayEdit(); toast('已更新繳費紀錄');
}
async function deletePayEvent(){
  const m=ui.pemodal;
  if(!confirm(`確定刪除 ${m.sname} 這筆繳費（${fmtDate(m.date)}　$${(m.amount*m.periods).toLocaleString()}）？\n此動作無法復原。`)) return;
  const { error } = await sb.from('payments').delete().eq('id',m.id);
  if(error){ toast('刪除失敗：'+error.message); return; }
  if(REPORTS.payments) REPORTS.payments=REPORTS.payments.filter(p=>p.id!==m.id);
  closePayEvent(); refreshAfterPayEdit(); toast('已刪除繳費紀錄');
}
async function refundPayEvent(){
  const m=ui.pemodal;
  const refundAmt=-Math.abs(m.amount);
  if(!confirm(`對 ${m.sname} 記一筆退費 $${(refundAmt*m.periods).toLocaleString()}（${m.billing}×${m.periods}）？\n原紀錄保留，另記一筆負數，報表營收會扣掉。`)) return;
  const rec={ student_id:m.sid, billing:m.billing, periods:m.periods, amount:refundAmt, pay_date:today() };
  const { data, error } = await sb.from('payments').insert(rec).select().single();
  if(error){ toast('退費失敗：'+error.message); return; }
  if(REPORTS.payments) REPORTS.payments.push(data);
  closePayEvent(); refreshAfterPayEdit(); toast('已記一筆退費');
}
// 編輯後刷新畫面；若學生 modal 開著，重新載入其繳費歷史
function refreshAfterPayEdit(){
  render();
  if(ui.smodal && !ui.smodal.isNew && ui.smodal.id){
    const sid=ui.smodal.id;
    sb.from('payments').select('*').eq('student_id',sid).then(({data,error})=>{
      if(ui.smodal && ui.smodal.id===sid){
        ui.smodal.history = error ? [] : (data||[]).sort((a,b)=>(b.pay_date||'').localeCompare(a.pay_date||''));
        renderStudentModal();
      }
    });
  }
}
