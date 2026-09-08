/* view-check.js — 上課核對頁 */
function checkRowHtml(s){
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
      <input class="num ${due?'due':''}" type="number" inputmode="numeric" value="${s.attended}" data-act="num" data-id="${s.id}">
      <button class="signbtn" data-act="sign" data-id="${s.id}" title="正負切換">±</button></div>
  </div>`;
}
// 清單主體：搜尋時只重繪這塊（不動搜尋框，避免打斷注音組字）
function checkBody(){
  const ats = activeTeachers();
  const orphans = DB.students.filter(s=>isActive(s) && (!s.t || !ats.find(t=>t.id===s.t)));
  const q = (ui.search||'').trim();
  // 全域搜尋：跨所有老師，依老師分組（換過老師的學生也一次找得到）
  if(q){
    const matches = DB.students.filter(s=>isActive(s) && s.name.includes(q));
    if(!matches.length) return `<div class="empty">找不到「${q}」的在學/新生學生</div>`;
    let html = `<div class="hint2">搜尋「${q}」：跨所有老師 ${matches.length} 位 · 直接改堂數／點<u>姓名</u>編輯</div>`;
    ats.forEach(t=>{
      const grp = matches.filter(s=>s.t===t.id);
      if(grp.length) html += `<div class="check-group">${t.name}${t.role}</div>` + grp.map(checkRowHtml).join('');
    });
    const orph = matches.filter(s=>!ats.find(t=>t.id===s.t));
    if(orph.length) html += `<div class="check-group">⚠ 未指派</div>` + orph.map(checkRowHtml).join('');
    return html;
  }
  // 正常：單一老師分頁（未核對在上、已核對移到下方群組）
  const isOrphan = ui.tab==='__orphan';
  const list = isOrphan ? orphans.slice() : DB.students.filter(s=>s.t===ui.tab && isActive(s));
  const checked = list.filter(s=>s.checked).length;
  const pending = list.filter(s=>!s.checked);
  const done    = list.filter(s=>s.checked);
  let rows = pending.map(checkRowHtml).join('');
  if(done.length) rows += `<div class="check-group">已核對 ${done.length}</div>` + done.map(checkRowHtml).join('');
  if(!list.length) rows = `<div class="empty">${isOrphan?'沒有待指派的學生 🎉':'這位老師目前沒有上課中的學生'}</div>`;
  const head = isOrphan
    ? `<div class="hint2 warn">這些學生的老師已停用 — 請點<u>姓名</u>改指派給在職老師（改完就會離開此清單）</div>`
    : `<div class="addbar">
         <button class="addstu" onclick="openStudent(null)">＋ 新增學生（${teacherName(ui.tab)}）</button>
         <span class="checkbar2">已核對 ${checked}/${list.length}</span>
       </div>
       <div class="hint2">點數字或 ✓ 核對 · 點<u>姓名</u>編輯學生</div>`;
  return head + rows;
}
function checkView(){
  const ats = activeTeachers();
  const orphans = DB.students.filter(s=>isActive(s) && (!s.t || !ats.find(t=>t.id===s.t)));
  const valid = ats.map(t=>t.id); if(orphans.length) valid.push('__orphan');
  if(!valid.includes(ui.tab)) ui.tab = valid[0] || null;
  const searching = !!(ui.search && ui.search.trim());
  let tabs = ats.map(t=>{
    const cnt = DB.students.filter(s=>s.t===t.id && isActive(s)).length;
    return `<div class="tab ${!searching && ui.tab===t.id?'active':''}" onclick="setTab('${t.id}')">${t.name}<span class="cnt"> ${cnt}</span></div>`;
  }).join('');
  if(orphans.length) tabs += `<div class="tab orphan ${!searching && ui.tab==='__orphan'?'active':''}" onclick="setTab('__orphan')">⚠ 待指派<span class="cnt"> ${orphans.length}</span></div>`;
  const totalChecked = DB.students.filter(s=>s.checked).length;
  const newround = totalChecked ? `<div class="newround">
      <span>本梯已核對 <b>${totalChecked}</b> 位</span>
      <button class="nr-btn" onclick="clearAllChecks()">清除全部 · 開始新一梯</button>
    </div>` : '';
  // 搜尋框放在老師頁籤「之上」，且為跨老師全域搜尋
  return `${newround}
    <input class="searchbox" placeholder="🔍 搜尋學生姓名（跨所有老師）" value="${ui.search||''}" oninput="setSearch(this.value,event)" oncompositionend="setSearch(this.value,null)">
    <div class="tabs">${tabs}</div>
    <div id="cbody">${checkBody()}</div>`;
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
    if(act==='sign') el.onclick=()=>{                       // ± 正負切換（手機數字鍵盤沒負號）
      const inp=document.querySelector(`.num[data-id="${id}"]`);
      const v = -(parseInt((inp?inp.value:'0')||'0',10));
      updateNum(id, v);
    };
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
  if(e && e.isComposing) return;   // 組字中的 input 才跳過；compositionend 傳 null 進來 → 一定更新（避免手機 isComposing 旗標不準）
  const body=document.getElementById('cbody');
  if(body){ body.innerHTML=checkBody(); bindCheck(); }  // 只重繪清單、不動搜尋框（不打斷注音、結果即時出現）
  else render();
}
