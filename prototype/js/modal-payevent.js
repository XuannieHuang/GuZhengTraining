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
  const host=modalHost('peov');   // 桌機掛進右欄，手機維持 document.body
  const planOpts=['月繳','季繳','單堂'];
  const total=m.amount*m.periods;
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closePayEvent()">
    <div class="sheet">
      <div class="handle"></div>
      <h3><span class="sheet-ttl"><span class="t">${m.sname}</span>
        <span class="s">編輯繳費 · 不影響已上堂數</span>
      </span><span class="sheet-acts"><button class="sheet-x" onclick="closePayEvent()" title="關閉" aria-label="關閉">✕</button></span></h3>
      <div class="field f-plan"><label>方案</label><div class="chips">
        ${planOpts.map(p=>`<div class="chipbtn ${m.billing===p?'sel':''}" onclick="peField('billing','${p}')">${p}</div>`).join('')}
      </div></div>
      <div class="field f-att"><label>期數</label><div class="chips">
        ${[1,2,3].map(n=>`<div class="chipbtn ${m.periods===n?'sel':''}" onclick="peField('periods',${n})">${n} 期</div>`).join('')}
      </div></div>
      <div class="field f-amt"><label>單期學費</label>
        <input class="inp" type="number" inputmode="numeric" value="${m.amount}" oninput="ui.pemodal.amount=parseInt(this.value||'0',10);peTotal()">
        <div class="fieldhint">退費可填負數</div></div>
      <div class="field f-date"><label>繳費日</label>
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
  await syncLastPay(m.sid);
  closePayEvent(); refreshAfterPayEdit(); toast('已更新繳費紀錄');
}
async function deletePayEvent(){
  const m=ui.pemodal;
  if(!confirm(`確定刪除 ${m.sname} 這筆繳費（${fmtDate(m.date)}　$${(m.amount*m.periods).toLocaleString()}）？\n此動作無法復原。`)) return;
  const { error } = await sb.from('payments').delete().eq('id',m.id);
  if(error){ toast('刪除失敗：'+error.message); return; }
  if(REPORTS.payments) REPORTS.payments=REPORTS.payments.filter(p=>p.id!==m.id);
  const r = await syncLastPay(m.sid);
  closePayEvent(); refreshAfterPayEdit();
  toast(r==='cleared' ? '已刪除；這位學生已無繳費紀錄，最後繳費日一併清空' : '已刪除繳費紀錄');
}
async function refundPayEvent(){
  const m=ui.pemodal;
  const refundAmt=-Math.abs(m.amount);
  if(!confirm(`對 ${m.sname} 記一筆退費 $${(refundAmt*m.periods).toLocaleString()}（${m.billing}×${m.periods}）？\n原紀錄保留，另記一筆負數，報表營收會扣掉。`)) return;
  const rec={ student_id:m.sid, billing:m.billing, periods:m.periods, amount:refundAmt, pay_date:today() };
  const { data, error } = await sb.from('payments').insert(rec).select().single();
  if(error){ toast('退費失敗：'+error.message); return; }
  if(REPORTS.payments) REPORTS.payments.push(data);
  await syncLastPay(m.sid);            // 退費是負數，不會變成最後繳費，但其他紀錄可能需要重算
  closePayEvent(); refreshAfterPayEdit(); toast('已記一筆退費');
}
/* 繳費紀錄異動後，把「最後繳費」重算回 students。
   規則（2026-11-09 與使用者確認）：
   · 看得到的最新一筆繳費就是最後繳費日 → 取剩餘紀錄中金額為正的最新一筆（退回上一筆）
   · 一筆都不剩 → 清空。系統確實已無任何繳費紀錄，留著已刪除的日期會對不上畫面
   · 退費（負數）不列入 —— 「最後繳費」指的是最後一次收到錢
   回傳 'synced'（已退回上一筆）/ 'cleared'（已無紀錄，清空）/ 'error' */
async function syncLastPay(sid){
  if(!sid) return 'error';
  const { data, error } = await sb.from('payments')
    .select('pay_date,amount').eq('student_id', sid).gt('amount', 0)
    .order('pay_date', { ascending:false }).limit(1);
  if(error){ toast('最後繳費同步失敗：'+error.message); return 'error'; }

  const last = (data||[])[0] || null;
  const patch = { last_pay_date: last ? last.pay_date : null,
                  last_pay_amount: last ? last.amount : null };
  const s = DB.students.find(x=>x.id===sid);
  if(s && s.pay===patch.last_pay_date && s.amt===patch.last_pay_amount){
    return last ? 'synced' : 'cleared';          // 本來就一致，不用多寫一次
  }
  const { error:e2 } = await sb.from('students').update(patch).eq('id', sid);
  if(e2){ toast('最後繳費同步失敗：'+e2.message); return 'error'; }
  if(s){ s.pay = patch.last_pay_date; s.amt = patch.last_pay_amount; }
  return last ? 'synced' : 'cleared';
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
