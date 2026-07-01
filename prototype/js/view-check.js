/* view-check.js — 上課核對頁 */
function checkView(){
  const ats = activeTeachers();
  // 孤兒學生：在學/新生，但老師已停用或無老師 → 待指派
  const orphans = DB.students.filter(s=>isActive(s) && (!s.t || !ats.find(t=>t.id===s.t)));
  const valid = ats.map(t=>t.id); if(orphans.length) valid.push('__orphan');
  if(!valid.includes(ui.tab)) ui.tab = valid[0] || null;
  let tabs = ats.map(t=>{
    const cnt = DB.students.filter(s=>s.t===t.id && isActive(s)).length;
    return `<div class="tab ${ui.tab===t.id?'active':''}" onclick="setTab('${t.id}')">${t.name}<span class="cnt"> ${cnt}</span></div>`;
  }).join('');
  if(orphans.length) tabs += `<div class="tab orphan ${ui.tab==='__orphan'?'active':''}" onclick="setTab('__orphan')">⚠ 待指派<span class="cnt"> ${orphans.length}</span></div>`;
  const isOrphan = ui.tab==='__orphan';
  const totalChecked = DB.students.filter(s=>s.checked).length;   // 全部老師合計（清除為全域）
  const newround = totalChecked ? `<div class="newround">
      <span>本梯已核對 <b>${totalChecked}</b> 位</span>
      <button class="nr-btn" onclick="clearAllChecks()">清除全部 · 開始新一梯</button>
    </div>` : '';
  // 只顯示正在上課（在學/新生）；待指派分頁顯示孤兒學生
  let list = isOrphan ? orphans.slice() : DB.students.filter(s=>s.t===ui.tab && isActive(s));
  if(ui.search) list = list.filter(s=>s.name.includes(ui.search));
  const checked = list.filter(s=>s.checked).length;
  const checkRow = (s)=>{
    const due = isDue(s);
    const cls = `srow ${s.checked?'checked':''} ${due?'due':''}`;
    return `<div class="${cls}" data-id="${s.id}">
      <div class="chk ${s.checked?'on':''}" data-act="chk" data-id="${s.id}">✓</div>
      <div class="grow">
        <div class="name"><span class="ename" data-act="edit" data-id="${s.id}">${s.name}</span>
          <span class="badge med ${planClass(s.plan)}">${s.plan}</span>
          ${s.type==='雙人'?`<span class="badge dual">👥 ${s.partner?studentName(s.partner):'未配對'}</span>`:''}</div>
        ${(()=>{ const ms=[]; if(s.pay) ms.push('上次繳費 '+fmtDate(s.pay)); if(s.note) ms.push(s.note);
          return ms.length?`<div class="meta">${ms.join(' · ')}</div>`:''; })()}
      </div>
      <div class="numwrap"><label>已上</label>
        <input class="num ${due?'due':''}" type="number" inputmode="numeric" value="${s.attended}" data-act="num" data-id="${s.id}"></div>
    </div>`;
  };
  // 未核對在上、已核對自動移到下方群組（待核對清單隨進度變短）
  const pending = list.filter(s=>!s.checked);
  const done    = list.filter(s=>s.checked);
  let rows = pending.map(checkRow).join('');
  if(done.length) rows += `<div class="check-group">已核對 ${done.length}</div>` + done.map(checkRow).join('');
  if(!list.length) rows=`<div class="empty">${isOrphan?'沒有待指派的學生 🎉':'這位老師目前沒有上課中的學生'}</div>`;
  const head = isOrphan
    ? `<div class="hint2 warn">這些學生的老師已停用 — 請點<u>姓名</u>改指派給在職老師（改完就會離開此清單）</div>`
    : `<div class="addbar">
         <button class="addstu" onclick="openStudent(null)">＋ 新增學生（${teacherName(ui.tab)}）</button>
         <span class="checkbar2">已核對 ${checked}/${list.length}</span>
       </div>
       <div class="hint2">點數字或 ✓ 核對 · 點<u>姓名</u>編輯學生</div>`;
  return `${newround}
    <div class="tabs">${tabs}</div>
    <input class="searchbox" placeholder="🔍 搜尋學生姓名" value="${ui.search}" oninput="setSearch(this.value,event)" oncompositionend="setSearch(this.value,event)">
    ${head}
    ${rows}`;
}
async function clearAllChecks(){
  const n=DB.students.filter(s=>s.checked).length;
  if(!n){ toast('目前沒有勾選'); return; }
  if(!confirm(`要清除全部 ${n} 筆核對勾選、開始新一梯嗎？\n（只清勾選，不影響已上堂數）`)) return;
  const { error } = await sb.from('students').update({checked:false}).eq('checked',true);
  if(error){ toast('清除失敗：'+error.message); return; }
  DB.students.forEach(s=>{ s.checked=false; });
  render(); toast('已清除全部勾選，開始新一梯');
}

function bindCheck(){
  document.querySelectorAll('[data-act]').forEach(el=>{
    const act=el.getAttribute('data-act'), id=el.getAttribute('data-id');
    if(act==='chk') el.onclick=()=>toggleCheck(id);
    if(act==='edit') el.onclick=()=>openStudent(id);
    if(act==='num'){
      el.onchange=()=>updateNum(id, el.value);
      el.onfocus=()=>el.select();
    }
  });
}
function updateNum(id,val){
  const s=DB.students.find(s=>s.id===id); if(!s) return;
  s.attended = parseInt(val||'0',10); s.checked=true;
  pushStudent(id, { attended:s.attended, checked:true });
  render();   // 重繪：該生自動移到下方「已核對」群組
}
function toggleCheck(id){
  const s=DB.students.find(s=>s.id===id); if(!s) return;
  s.checked=!s.checked;
  pushStudent(id, { checked:s.checked });
  render();   // 重繪：勾選移到下方、取消勾選移回上方
}
function setTab(id){ ui.tab=id; ui.search=''; render(); }
function setSearch(v,e){
  ui.search=v;
  if(e && e.isComposing) return;   // 輸入法（注音）組字中：先不重繪，等組完字再篩選
  render(); const inp=document.querySelector('.searchbox'); if(inp){inp.focus(); inp.setSelectionRange(v.length,v.length);} }
