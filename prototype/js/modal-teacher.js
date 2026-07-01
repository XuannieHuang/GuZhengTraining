/* modal-teacher.js — 老師管理 modal（新增／編輯；不做刪除） */
function openTeacher(id){
  document.body.classList.add('modal-open');
  const t = id ? DB.teachers.find(x=>x.id===id) : null;
  ui.tmodal = t ? { id:t.id, name:t.name, role:t.role, inst:t.inst.slice(), isNew:false }
                : { id:null, name:'', role:'老師', inst:['古箏'], isNew:true };
  renderTeacherModal();
}
function renderTeacherModal(){
  const m=ui.tmodal; if(!m) return;
  const esc=(v)=>String(v==null?'':v).replace(/"/g,'&quot;');
  let host=document.getElementById('tov'); if(!host){ host=document.createElement('div'); host.id='tov'; document.body.appendChild(host); }
  const roleChips=['老師','主任'].map(o=>`<div class="chipbtn ${m.role===o?'sel':''}" onclick="tfield('role','${o}')">${o}</div>`).join('');
  let instOpts=[...new Set(PLANS.map(p=>p.instrument))]; if(!instOpts.length) instOpts=['古箏','琵琶'];
  m.inst.forEach(i=>{ if(!instOpts.includes(i)) instOpts.push(i); });  // 保留老師已有、但方案還沒建的樂器
  const instChips=instOpts.map(o=>`<div class="chipbtn ${m.inst.includes(o)?'sel':''}" onclick="tInst('${o}')">${o}</div>`).join('');
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closeTeacher()">
    <div class="sheet">
      <div class="handle"></div>
      <h3>${m.isNew?'新增老師':'編輯老師'}</h3>
      <div class="field"><label>姓名</label><input class="inp" value="${esc(m.name)}" oninput="ui.tmodal.name=this.value"></div>
      <div class="field"><label>角色</label><div class="chips">${roleChips}</div></div>
      <div class="field"><label>教授樂器 <span class="sublabel">（可多選）</span></label><div class="chips">${instChips}</div></div>
      <div class="actions">
        <button class="btn ghost" onclick="closeTeacher()">取消</button>
        <button class="btn primary" onclick="saveTeacher()">${m.isNew?'新增':'儲存'}</button>
      </div>
    </div></div>`;
}
function tfield(k,v){ ui.tmodal[k]=v; renderTeacherModal(); }
function tInst(o){
  const a=ui.tmodal.inst, i=a.indexOf(o);
  if(i<0) a.push(o); else if(a.length>1) a.splice(i,1);  // 至少留一個
  renderTeacherModal();
}
function closeTeacher(){ const h=document.getElementById('tov'); if(h) h.remove(); ui.tmodal=null; document.body.classList.remove('modal-open'); }
async function saveTeacher(){
  const m=ui.tmodal;
  if(!m.name || !m.name.trim()){ toast('請輸入姓名'); return; }
  const rec={ name:m.name.trim(), role:m.role, instruments:m.inst };
  if(m.isNew){
    rec.sort = (DB.teachers.reduce((mx,t)=>Math.max(mx,t.sort||0),0))+1;
    const { data, error } = await sb.from('teachers').insert(rec).select().single();
    if(error){ toast(/duplicate|unique/i.test(error.message)?'已有同名老師':'新增失敗：'+error.message); return; }
    DB.teachers.push(mapTeacher(data));
  } else {
    const { error } = await sb.from('teachers').update(rec).eq('id',m.id);
    if(error){ toast('儲存失敗：'+error.message); return; }
    const t=DB.teachers.find(x=>x.id===m.id); Object.assign(t,{ name:rec.name, role:rec.role, inst:rec.instruments });
  }
  const created=m.isNew; closeTeacher(); render(); toast(created?'已新增老師':'已更新老師');
}
