/* modal-payment.js — 記繳費 modal（只記 log，不改堂數） */
function openPay(id){ ui.modal={id, plan:null, periods:1, amt:null, date:today()}; document.body.classList.add('modal-open'); renderModal(); }
function renderModal(){
  const s=DB.students.find(s=>s.id===ui.modal.id); if(!s) return;
  if(ui.modal.plan===null) ui.modal.plan=s.plan;
  if(ui.modal.amt===null) ui.modal.amt=s.amt||planPrice(s.inst,s.type,ui.modal.plan);
  const planOpts = s.inst==='琵琶' ? ['月繳','單堂'] : ['月繳','季繳','單堂'];
  let host=document.getElementById('ov'); if(!host){ host=document.createElement('div'); host.id='ov'; document.body.appendChild(host); }
  const size = ui.modal.plan==='季繳'?12:(ui.modal.plan==='單堂'?1:4);
  const total = ui.modal.amt * ui.modal.periods;
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closePay()">
    <div class="sheet">
      <div class="handle"></div>
      <h3>${s.name}　記一筆繳費</h3>
      <div class="sub-h">${teacherName(s.t)} · ${s.inst}${s.type}班</div>
      <div class="field"><label>方案</label><div class="chips">
        ${planOpts.map(p=>`<div class="chipbtn ${ui.modal.plan===p?'sel':''}" onclick="setPlan('${p}')">${p}<span class="chip-sub"> ${p==='季繳'?12:(p==='單堂'?1:4)}堂</span></div>`).join('')}
      </div></div>
      <div class="field"><label>期數</label><div class="chips">
        ${[1,2,3].map(n=>`<div class="chipbtn ${ui.modal.periods===n?'sel':''}" onclick="setPeriods(${n})">${n} 期</div>`).join('')}
      </div></div>
      <div class="field"><label>金額 <span class="sublabel">／期（自動帶上次金額，可改）</span></label>
        <input class="inp" type="number" inputmode="numeric" value="${ui.modal.amt}" oninput="ui.modal.amt=parseInt(this.value||'0',10)">
        <div class="presets">
          ${s.amt?`<div class="preset" onclick="setAmt(${s.amt})">上次 <b>$${s.amt}</b></div>`:''}
          <div class="preset" onclick="setAmt(${planPrice(s.inst,s.type,ui.modal.plan)})">常用價 <b>$${planPrice(s.inst,s.type,ui.modal.plan).toLocaleString()}</b></div>
        </div>
      </div>
      <div class="field"><label>繳費日</label>
        <input class="inp" type="date" value="${ui.modal.date}" onchange="ui.modal.date=this.value"></div>
      <div class="summary"><span>合計（${ui.modal.periods} 期）</span><b>$${total.toLocaleString()}</b></div>
      <div class="hint">＊確認後「已上堂數」自動 −${size * ui.modal.periods} 堂（${s.attended} → ${s.attended - size*ui.modal.periods}），等於滾到下一期。</div>
      <div class="actions">
        <button class="btn ghost" onclick="closePay()">取消</button>
        <button class="btn primary" onclick="confirmPay()">確認繳費</button>
      </div>
    </div></div>`;
}
function setAmt(v){ ui.modal.amt=v; renderModal(); }
function setPlan(p){ const s=DB.students.find(s=>s.id===ui.modal.id); ui.modal.plan=p; ui.modal.amt=(s&&s.plan===p&&s.amt)?s.amt:planPrice(s.inst,s.type,p); renderModal(); }
function setPeriods(n){ ui.modal.periods=n; renderModal(); }
function closePay(){ const h=document.getElementById('ov'); if(h) h.remove(); ui.modal=null; document.body.classList.remove('modal-open'); }
function planSessions(plan){ return plan==='季繳'?12:(plan==='單堂'?1:4); }
function confirmPay(){
  const s=DB.students.find(s=>s.id===ui.modal.id);
  const m=ui.modal, total=m.amt*m.periods;
  const sess = planSessions(m.plan) * m.periods;          // 本次繳費對應堂數
  s.pay=m.date; s.amt=m.amt; s.plan=m.plan; s.notified=false;
  s.attended = (s.attended||0) - sess;                    // 自動扣堂（滾到下一期）
  // 1) 繳費紀錄 log
  sb.from('payments').insert({ student_id:s.id, billing:m.plan, periods:m.periods, amount:m.amt, pay_date:m.date })
    .then(({error})=>{ if(error) toast('繳費紀錄失敗：'+error.message); });
  // 2) 更新學生最後繳費資訊 + 已扣堂後的已上堂數
  pushStudent(s.id, { last_pay_date:m.date, last_pay_amount:m.amt, plan:m.plan, notified:false, attended:s.attended });
  closePay(); render();
  toast(`已記繳費 $${total.toLocaleString()}　已上堂數 −${sess} → ${s.attended}`);
}
