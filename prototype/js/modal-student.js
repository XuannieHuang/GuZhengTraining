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
  let host=document.getElementById('sov'); if(!host){ host=document.createElement('div'); host.id='sov'; document.body.appendChild(host); }
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
    partnerField=`<div class="field"><label>雙人組同學 <span class="sublabel">（各自繳費，連動檢視）</span></label>
      ${cands.length ? `<div class="chips">${chips}</div>`
        : `<div class="meta">目前沒有可配對的同學，等對方建檔（同老師·雙人班）後再回來這裡配對。</div>`}</div>`;
  }
  // 💲 記繳費 inline 表單（僅編輯既有學生；不另開彈窗）
  let payField='';
  if(!m.isNew){
    if(!m.payForm) m.payForm={ plan:m.plan, periods:1, amt:m.amt||planPrice(m.inst,m.type,m.plan), date:today() };
    const pf=m.payForm, sess=planSessions(pf.plan)*pf.periods, total=(pf.amt||0)*pf.periods;
    const planOpts=m.inst==='琵琶'?['月繳','單堂']:['月繳','季繳','單堂'];
    payField=`<div class="field paybox"><label>💲 記一筆繳費 <span class="sublabel">（確認後已上堂數自動 −${sess}）</span></label>
      <div class="chips">${planOpts.map(p=>`<div class="chipbtn ${pf.plan===p?'sel':''}" onclick="pfld('plan','${p}')">${p}<span class="chip-sub"> ${planSessions(p)}堂</span></div>`).join('')}</div>
      <div class="chips">${[1,2,3].map(n=>`<div class="chipbtn ${pf.periods===n?'sel':''}" onclick="pfld('periods',${n})">${n} 期</div>`).join('')}</div>
      <input class="inp" type="number" inputmode="numeric" value="${pf.amt}" oninput="ui.smodal.payForm.amt=parseInt(this.value||'0',10)" placeholder="金額／期">
      <input class="inp" type="date" value="${pf.date}" onchange="ui.smodal.payForm.date=this.value">
      <div class="summary"><span>合計（${pf.periods} 期）</span><b>$${total.toLocaleString()}</b></div>
      <button class="btn primary block paybtn" onclick="payFromStudent()">確認記繳費</button>
    </div>`;
  }
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closeStudent()">
    <div class="sheet">
      <div class="handle"></div>
      <h3>${m.isNew?'新增學生':'編輯學生'}</h3>
      <div class="field"><label>姓名</label><input class="inp" value="${esc(m.name)}" oninput="ui.smodal.name=this.value"></div>
      <div class="field"><label>任課老師</label><div class="chips">${tChips}</div></div>
      <div class="field"><label>學習樂器</label><div class="chips">${chips('inst',instOpts)}</div></div>
      <div class="field"><label>授課類型</label><div class="chips">${chips('type',typeOpts)}</div></div>
      ${partnerField}
      <div class="field"><label>方案</label><div class="chips">${chips('plan',['月繳','季繳','單堂'])}</div></div>
      <div class="field"><label>狀態 <span class="sublabel">（停課/待確認不會出現在核對）</span></label><div class="chips">${chips('status',['在學','新生','停課','待確認'])}</div></div>
      <div class="field"><label>已上堂數</label><input class="inp" type="number" inputmode="numeric" value="${m.attended||0}" oninput="ui.smodal.attended=parseInt(this.value||'0',10)"></div>
      <div class="field"><label>備註</label><textarea class="inp note-area" rows="${Math.min(8,Math.max(2,Math.ceil(((m.note||'').length+1)/16)))}" oninput="ui.smodal.note=this.value;this.style.height='auto';this.style.height=this.scrollHeight+'px'">${htmlesc(m.note)}</textarea></div>
      ${payField}
      ${m.isNew?'':`<div class="field"><label>繳費紀錄</label>
        ${m.history===null ? '<div class="meta">載入中…</div>'
          : (m.history.length ? m.history.map(p=>{ const amt=(p.amount||0)*(p.periods||1); return `<div class="histrow pay clickable" onclick="openPayEvent('${p.id}')">
              <span>${fmtDate(p.pay_date)}　<span class="t-muted">${p.billing||''}${p.periods>1?' ×'+p.periods:''}</span></span>
              <b class="${amt<0?'t-red':'t-primary'}">$${amt.toLocaleString()}</b></div>`; }).join('')
            : '<div class="meta">尚無繳費紀錄（用「💲 記繳費」記的會出現在這，可點進來改／刪／退費）</div>')}
      </div>`}
      ${(m.isNew || !(m.tchanges&&m.tchanges.length))?'':`<div class="field"><label>老師異動歷史</label>
        ${m.tchanges.map(c=>`<div class="histrow pay">
          <span class="t-muted nowrap">${fmtDate2(c.changed_at)}</span>
          <span>${teacherName(c.from_teacher_id)||'未指派'} → <b>${teacherName(c.to_teacher_id)||'未指派'}</b></span></div>`).join('')}
      </div>`}
      <div class="actions">
        <button class="btn ghost" onclick="closeStudent()">取消</button>
        <button class="btn primary" onclick="saveStudent()">${m.isNew?'新增':'儲存'}</button>
      </div>
    </div></div>`;
}
function sfield(k,v){ ui.smodal[k]=v; renderStudentModal(); }
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
  m.payForm=null;   // 重置表單
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
  let studentId=m.id;
  if(m.isNew){
    const { data, error } = await sb.from('students').insert(rec).select().single();
    if(error){ toast('新增失敗：'+error.message); return; }
    DB.students.push(mapStudent(data)); studentId=data.id;
  } else {
    const { error } = await sb.from('students').update(rec).eq('id',m.id);
    if(error){ toast('儲存失敗：'+error.message); return; }
    const s=DB.students.find(x=>x.id===m.id);
    Object.assign(s,{ name:rec.name, t:rec.teacher_id, inst:rec.instrument, type:rec.class_type,
      plan:rec.plan, attended:rec.attended, status:rec.status, partner:partnerId, note:rec.note||'' });
  }
  await applyPartnerLink(studentId, partnerId, prevPartner);   // 維持雙向配對一致
  if(!m.isNew && (prevTeacher||null)!==(m.t||null)) logTeacherChange(studentId, prevTeacher, m.t);  // 換老師 → 記異動
  const created=m.isNew; closeStudent(); toast(created?'已新增學生':'已更新學生');   // closeStudent 已重繪背景
}
