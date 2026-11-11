/* modal-student.js — 學生管理 modal（新增／編輯） */
function openStudent(id){
  const s = id ? DB.students.find(x=>x.id===id) : null;
  ui.smodal = s ? Object.assign({}, s, {isNew:false, history:null, tchanges:null})
                : { isNew:true, id:null, name:'', t:ui.tab, inst:'古箏', type:'個人', plan:'季繳', attended:0, status:'新生', contact:'', partner:null, note:'' };
  document.body.classList.add('modal-open');
  renderStudentModal();
  if(id){ // 載入這位學生的繳費歷史
    sb.from('payments').select('*').eq('student_id', id).then(({data,error})=>{
      if(ui.smodal && ui.smodal.id===id){
        ui.smodal.history = error ? [] : (data||[]).sort((a,b)=>(b.pay_date||'').localeCompare(a.pay_date||''));
        renderStudentModal();
      }
    });
    // 老師異動歷史
    sb.from('teacher_changes').select('*').eq('student_id', id).then(({data,error})=>{
      if(ui.smodal && ui.smodal.id===id){
        ui.smodal.tchanges = error ? [] : (data||[]).sort((a,b)=>(b.changed_at||'').localeCompare(a.changed_at||''));
        renderStudentModal();
      }
    });
  }
}
function renderStudentModal(){
  const m=ui.smodal; if(!m) return;
  /* 桌機把這張表單拆成三個分頁（基本資料／記繳費／紀錄），一次只顯示一組 ——
     欄位 12 個又有長度不定的繳費紀錄，單欄排下來一定要捲。
     新增學生沒有紀錄可看，維持原本一路到底的流程。 */
  const tabbed = (typeof isDesk==='function') && isDesk() && !m.isNew;
  if(tabbed && !m.pane) m.pane='data';
  const pane = (k)=> !tabbed || m.pane===k;
  const host=modalHost('sov');   // 桌機掛進右欄，手機維持 document.body
  const esc=(v)=>String(v==null?'':v).replace(/"/g,'&quot;');
  const htmlesc=(v)=>String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const chips=(key,opts)=>opts.map(o=>`<div class="chipbtn ${m[key]===o?'sel':''}" onclick="sfield('${key}','${o}')">${o}</div>`).join('');
  const vchips=(key,pairs)=>pairs.map(([v,l])=>`<div class="chipbtn ${m[key]===v?'sel':''}" onclick="sfield('${key}','${v}')">${l}</div>`).join('');
  const tChips=activeTeachers().map(t=>`<div class="chipbtn ${m.t===t.id?'sel':''}" onclick="sfield('t','${t.id}')">${t.name}</div>`).join('');
  let instOpts=[...new Set(PLANS.map(p=>p.instrument))]; if(!instOpts.length) instOpts=['古箏','琵琶'];
  if(m.inst && !instOpts.includes(m.inst)) instOpts.push(m.inst);
  let typeOpts=[...new Set(PLANS.map(p=>p.class_type))]; if(!typeOpts.length) typeOpts=['個人','團體','雙人'];
  if(m.type && !typeOpts.includes(m.type)) typeOpts.push(m.type);
  // 雙人組：可配對的同學（同老師、雙人班、在學/新生，排除自己）
  let partnerField='';
  if(m.type==='雙人'){
    const cands=DB.students.filter(s=>s.id!==m.id && s.type==='雙人' && s.t===m.t && isActive(s));
    let chips=cands.map(c=>{
      const taken = c.partner && c.partner!==m.id ? `<span class="chip-sub">原配 ${studentName(c.partner)}</span>` : '';
      return `<div class="chipbtn ${m.partner===c.id?'sel':''}" onclick="sfield('partner','${c.id}')">${c.name}${taken}</div>`;
    }).join('');
    if(m.partner) chips += `<div class="chipbtn ${!m.partner?'sel':''}" onclick="sfield('partner',null)">無／解除</div>`;
    partnerField=`<div class="field f-partner"><label>雙人組同學</label>
      ${cands.length ? `<div class="chips">${chips}</div>`
        : `<div class="meta">目前沒有可配對的同學</div>`}</div>`;
  }
  // 💲 記繳費 inline 表單（新生建檔可一併登記首期；舊生直接記一筆）
  let payField='';
  {
    if(!m.payForm) m.payForm={ plan:m.plan, periods:1, amt:m.amt||planPrice(m.inst,m.type,m.plan), date:today() };
    const pf=m.payForm, sess=planSessions(pf.plan)*pf.periods, total=(pf.amt||0)*pf.periods;
    const planOpts=m.inst==='琵琶'?['月繳','單堂']:['月繳','季繳','單堂'];
    const payFields=`
      <div class="chips">${planOpts.map(p=>`<div class="chipbtn ${pf.plan===p?'sel':''}" onclick="pfld('plan','${p}')">${p}<span class="chip-sub"> ${planSessions(p)}堂</span></div>`).join('')}</div>
      <div class="chips">${[1,2,3].map(n=>`<div class="chipbtn ${pf.periods===n?'sel':''}" onclick="pfld('periods',${n})">${n} 期</div>`).join('')}</div>
      <div class="payrow">
        <input class="inp" type="number" inputmode="numeric" value="${pf.amt}" oninput="ui.smodal.payForm.amt=parseInt(this.value||'0',10)" placeholder="金額／期">
        <input class="inp" type="date" value="${pf.date}" onchange="ui.smodal.payForm.date=this.value">
      </div>
      <div class="summary"><span>合計（${pf.periods} 期）</span><b>$${total.toLocaleString()}</b></div>`;
    if(m.isNew){
      payField=`<div class="field paybox">
        <label class="paytoggle"><input type="checkbox" ${m.payOn?'checked':''} onchange="togglePayBox(this.checked)"> 💲 一併登記首期繳費</label>
        ${m.payOn?`${payFields}`:''}
      </div>`;
    } else if(tabbed){
      // 分頁模式：點到「記繳費」那一頁本身就是入口，不必再勾一次
      payField=`<div class="field paybox">${payFields}
        <button class="btn primary block paybtn" onclick="payFromStudent()">確認記繳費</button>
      </div>`;
    } else {
      // 手機：預設收合。展開著的話，那顆整條寬的綠色按鈕跟底部「儲存」同色同寬，
      // 改學生資料往下捲時很容易誤按成記一筆繳費。
      payField=`<div class="field paybox">
        <label class="paytoggle"><input type="checkbox" ${m.payOn?'checked':''} onchange="togglePayBox(this.checked)"> 💲 記一筆繳費</label>
        ${m.payOn?`${payFields}
        <button class="btn primary block paybtn" onclick="payFromStudent()">確認記繳費</button>`:''}
      </div>`;
    }
  }
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closeStudent()">
    <div class="sheet">
      <div class="handle"></div>
      <h3><span class="sheet-ttl">
        <span class="t"><input class="ttl-inp" value="${esc(m.name)}" placeholder="學生姓名" oninput="ui.smodal.name=this.value"></span>
        <span class="s">${m.isNew?'新增學生':'編輯學生'}</span>
      </span><span class="sheet-acts"><button class="sheet-x" onclick="closeStudent()" title="關閉" aria-label="關閉">✕</button></span></h3>
      ${tabbed?`<div class="sheet-tabs">
        <button class="${m.pane==='data'?'on':''}" onclick="sPane('data')">基本資料</button>
        <button class="${m.pane==='pay'?'on':''}" onclick="sPane('pay')">記繳費</button>
        <button class="${m.pane==='log'?'on':''}" onclick="sPane('log')">紀錄${
          (m.history&&m.history.length)?`<span class="n">${m.history.length}</span>`:''}</button>
      </div>`:''}
      ${pane('data')?`
      <div class="field f-tch"><label>任課老師</label><div class="chips">${tChips}</div></div>
      <div class="field f-inst"><label>學習樂器</label><div class="chips">${chips('inst',instOpts)}</div></div>
      <div class="field f-type"><label>授課類型</label><div class="chips">${chips('type',typeOpts)}</div></div>
      ${partnerField}
      <div class="field f-plan"><label>方案</label><div class="chips">${chips('plan',['月繳','季繳','單堂'])}</div></div>
      <div class="field f-status"><label>狀態</label><div class="chips">${chips('status',['在學','新生','停課','待確認'])}</div></div>
      <div class="field f-att"><label>已上堂數</label><input class="inp" type="number" inputmode="numeric" value="${m.attended||0}" oninput="ui.smodal.attended=parseInt(this.value||'0',10)"></div>
      <div class="field f-note"><label>備註</label><textarea class="inp note-area" rows="${Math.min(8,Math.max(2,Math.ceil(((m.note||'').length+1)/16)))}" oninput="ui.smodal.note=this.value;this.style.height='auto';this.style.height=this.scrollHeight+'px'">${htmlesc(m.note)}</textarea></div>
      `:''}
      ${pane('pay')?payField:''}
      ${(m.isNew||!pane('log'))?'':`<div class="field f-hist"><label>繳費紀錄</label>
        ${m.history===null ? '<div class="meta">載入中…</div>'
          : (m.history.length ? m.history.map(p=>{ const amt=(p.amount||0)*(p.periods||1); return `<div class="histrow pay clickable" onclick="openPayEvent('${p.id}')">
              <span class="hleft"><span class="hdate">${fmtDate2(p.pay_date)}</span><span class="t-muted">${p.billing||''}${p.periods>1?' ×'+p.periods:''}</span></span>
              <b class="${amt<0?'t-red':'t-primary'}">$${amt.toLocaleString()}</b></div>`; }).join('')
            : '<div class="meta">尚無繳費紀錄</div>')}
      </div>`}
      ${(m.isNew || !pane('log') || !(m.tchanges&&m.tchanges.length))?'':`<div class="field f-tchlog"><label>老師異動歷史</label>
        ${m.tchanges.map(c=>`<div class="histrow pay">
          <span class="hdate">${fmtDate2(c.changed_at)}</span>
          <span>${teacherName(c.from_teacher_id)||'未指派'} → <b>${teacherName(c.to_teacher_id)||'未指派'}</b></span></div>`).join('')}
      </div>`}
      ${(m.isNew||!pane('data'))?'':`<div class="dz"><button class="dz-link" onclick="deleteStudent()">刪除學生</button></div>`}
      <div class="actions">
        <button class="btn ghost" onclick="closeStudent()">取消</button>
        <button class="btn primary" onclick="saveStudent()">${m.isNew?'新增':'儲存'}</button>
      </div>
    </div></div>`;
}
function sfield(k,v){ ui.smodal[k]=v; renderStudentModal(); }
/* 桌機分頁切換。點到「記繳費」那一頁就直接展開表單 —— 分頁本身已經是刻意的動作，
   不必再多一道勾選（手機維持勾選，因為那邊是一路往下捲、容易誤按）。 */
function sPane(v){
  const m=ui.smodal; if(!m) return;
  m.pane=v;
  if(v==='pay') m.payOn=true;
  renderStudentModal();
}
/* 勾起「記一筆繳費」會在下方展開一整塊，如果面板已經捲到別處就看不到它展開。
   這裡把它捲進視野（block:'nearest' —— 已經看得到就不動）。 */
function togglePayBox(on){
  ui.smodal.payOn = on;
  renderStudentModal();
  if(on){ const b=document.querySelector('#sov .paybox'); if(b) b.scrollIntoView({block:'nearest'}); }
}
function pfld(k,v){
  const m=ui.smodal, pf=m.payForm; pf[k]=v;
  if(k==='plan') pf.amt=(m.plan===v && m.amt)?m.amt:planPrice(m.inst,m.type,v);  // 換方案帶常用價
  renderStudentModal();
}
async function payFromStudent(){
  const m=ui.smodal, pf=m.payForm;
  const sess=planSessions(pf.plan)*pf.periods;
  const { error }=await sb.from('payments').insert({ student_id:m.id, billing:pf.plan, periods:pf.periods, amount:pf.amt, pay_date:pf.date });
  if(error){ toast('繳費失敗：'+error.message); return; }
  m.attended=(m.attended||0)-sess; m.plan=pf.plan; m.pay=pf.date; m.amt=pf.amt;   // 扣堂 + 更新最後繳費
  pushStudent(m.id,{ last_pay_date:pf.date, last_pay_amount:pf.amt, plan:pf.plan, notified:false, attended:m.attended });
  const s=DB.students.find(x=>x.id===m.id); if(s) Object.assign(s,{ pay:pf.date, amt:pf.amt, plan:pf.plan, attended:m.attended, notified:false });
  m.payForm=null; m.payOn=false;   // 重置表單並收合，避免連續誤按
  toast(`已記繳費　已上堂數 −${sess} → ${m.attended}`);
  sb.from('payments').select('*').eq('student_id',m.id).then(({data})=>{ if(ui.smodal&&ui.smodal.id===m.id){ ui.smodal.history=(data||[]).sort((a,b)=>(b.pay_date||'').localeCompare(a.pay_date||'')); renderStudentModal(); }});
  renderStudentModal();
}
function closeStudent(){ const h=document.getElementById('sov'); if(h) h.remove(); ui.smodal=null; document.body.classList.remove('modal-open'); render(); }
async function saveStudent(){
  const m=ui.smodal;
  if(!m.name || !m.name.trim()){ toast('請輸入姓名'); return; }
  const partnerId = m.type==='雙人' ? (m.partner||null) : null;   // 非雙人班一律無配對
  const prevPartner = m.isNew ? null : (DB.students.find(x=>x.id===m.id)?.partner || null);
  const prevTeacher = m.isNew ? null : (DB.students.find(x=>x.id===m.id)?.t || null);
  const rec={ name:m.name.trim(), teacher_id:m.t||null, instrument:m.inst, class_type:m.type,
    plan:m.plan, attended:m.attended||0, status:m.status, partner_id:partnerId, note:(m.note||'').trim()||null };
  // 停課日：轉成停課時記下當天，轉離停課時清掉。已停課者再存檔不覆蓋原本的日期。
  const was = m.isNew ? null : (DB.students.find(x=>x.id===m.id)||{}).stopped;
  if(m.status==='停課') rec.stopped_at = was || new Date().toISOString();
  else rec.stopped_at = null;
  let studentId=m.id;
  if(m.isNew){
    const { data, error } = await sb.from('students').insert(rec).select().single();
    if(error){ toast('新增失敗：'+error.message); return; }
    DB.students.push(mapStudent(data)); studentId=data.id;
    // 一併登記首期繳費（勾選時）：只記一筆繳費，不扣堂（新生從你填的已上堂數開始）
    if(m.payOn && m.payForm && m.payForm.amt){
      const pf=m.payForm;
      const { error:perr } = await sb.from('payments').insert({ student_id:studentId, billing:pf.plan, periods:pf.periods, amount:pf.amt, pay_date:pf.date });
      if(perr){ toast('學生已新增，但首期繳費記錄失敗：'+perr.message); }
      else {
        pushStudent(studentId, { last_pay_date:pf.date, last_pay_amount:pf.amt });
        const s=DB.students.find(x=>x.id===studentId); if(s) Object.assign(s,{ pay:pf.date, amt:pf.amt });
      }
    }
  } else {
    const { error } = await sb.from('students').update(rec).eq('id',m.id);
    if(error){ toast('儲存失敗：'+error.message); return; }
    const s=DB.students.find(x=>x.id===m.id);
    Object.assign(s,{ name:rec.name, t:rec.teacher_id, inst:rec.instrument, type:rec.class_type,
      plan:rec.plan, attended:rec.attended, status:rec.status, partner:partnerId, note:rec.note||'' });
  }
  await applyPartnerLink(studentId, partnerId, prevPartner);   // 維持雙向配對一致
  if(!m.isNew && (prevTeacher||null)!==(m.t||null)) logTeacherChange(studentId, prevTeacher, m.t);  // 換老師 → 記異動
  const created=m.isNew, paid=m.isNew&&m.payOn&&m.payForm&&m.payForm.amt;
  closeStudent();                                                    // closeStudent 已重繪背景
  toast(created?(paid?'已新增學生並登記首期繳費（不扣堂）':'已新增學生'):'已更新學生');
}

/* 刪除學生＝註記刪除（寫入 deleted_at），不是真的從資料庫移除。
   繳費紀錄、換老師紀錄、租借全部原封不動保留，只是這位學生不再出現在 App 裡。 */
async function deleteStudent(){
  const m=ui.smodal; if(!m||m.isNew) return;
  const pays=(m.history||[]).length;
  const rents=DB.rentals.filter(r=>r.sid===m.id||r.name===m.name).length;

  const lines=[`確定刪除學生「${m.name}」？`,''];
  if(pays || rents){
    lines.push('資料不會真的消失，只是不再出現在 App 裡：');
    if(pays)  lines.push(`・繳費紀錄 ${pays} 筆　保留（報表營收照算）`);
    if(rents) lines.push(`・租借紀錄 ${rents} 筆　保留`);
  }else{
    lines.push('這位學生沒有繳費或租借紀錄。');
  }
  lines.push('', '刪除後無法在 App 內還原，需由管理者從資料庫處理。');
  if(!confirm(lines.join('\n'))) return;

  const { error } = await sb.from('students')
    .update({ deleted_at: new Date().toISOString() }).eq('id', m.id);
  if(error){
    toast(/deleted_at/.test(error.message)
      ? '資料庫還沒有 deleted_at 欄位，請先執行那行 SQL'
      : '刪除失敗：'+error.message);
    return;
  }
  DB.students = DB.students.filter(x=>x.id!==m.id);
  closeStudent(); render(); toast(`已刪除學生 ${m.name}`);
}
