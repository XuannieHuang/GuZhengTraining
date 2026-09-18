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
  const totalChecked = DB.students.filter(s=>s.checked).length;   // 全域（所有老師）
  const strip = totalChecked ? `<div class="nrstrip"><span>本梯已核對 <b>${totalChecked}</b> 位</span><span class="nr-clr" onclick="clearAllChecks()">清除·開始新一梯</span></div>` : '';
  // 全域搜尋：跨所有老師，依老師分組
  if(q){
    const matches = DB.students.filter(s=>isActive(s) && s.name.includes(q));
    if(!matches.length) return strip + `<div class="empty">找不到「${q}」的在學/新生學生</div>`;
    let inner = '';
    ats.forEach(t=>{
      const grp = matches.filter(s=>s.t===t.id);
      if(grp.length) inner += `<div class="check-group">${t.name}${t.role}</div>` + grp.map(checkRowHtml).join('');
    });
    const orph = matches.filter(s=>!ats.find(t=>t.id===s.t));
    if(orph.length) inner += `<div class="check-group">⚠ 未指派</div>` + orph.map(checkRowHtml).join('');
    return strip + `<div class="hint2">搜尋「${q}」：跨所有老師 ${matches.length} 位</div><div class="chk-card">${inner}</div>`;
  }
  // 待指派分頁（老師停用後的孤兒學生）
  if(ui.tab==='__orphan'){
    const rows = orphans.length ? orphans.map(checkRowHtml).join('') : `<div class="empty sm">沒有待指派的學生 🎉</div>`;
    return strip + `<div class="hint2 warn">這些學生的老師已停用 — 請點<u>姓名</u>改指派給在職老師</div><div class="chk-card">${rows}</div>`;
  }
  // 正常：待核對／已核對兩張卡；＋新增縮進待核對卡頭
  const list = DB.students.filter(s=>s.t===ui.tab && isActive(s));
  const pending = list.filter(s=>!s.checked);
  const done    = list.filter(s=>s.checked);
  const pendRows = pending.length ? pending.map(checkRowHtml).join('')
                 : `<div class="empty sm">${list.length?'都核對完成 🎉':'這位老師目前沒有上課中的學生'}</div>`;
  let body = `<div class="chk-card"><div class="chk-chead"><span class="chk-ttl">待核對 <b>${pending.length}</b></span>`
           + `<button class="chk-add" onclick="openStudent(null)">＋ 新增</button></div>${pendRows}</div>`;
  if(done.length) body += `<div class="chk-card done"><div class="chk-chead"><span class="chk-ttl">已核對 <b>${done.length}</b></span></div>${done.map(checkRowHtml).join('')}</div>`;
  return strip + body;
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
  // 搜尋框在老師頁籤之上（跨老師全域搜尋）；本梯清除改由 cbody 內的細長條處理
  return `<input class="searchbox" placeholder="🔍 搜尋學生姓名（跨所有老師）" value="${ui.search||''}" oninput="setSearch(this.value)" oncompositionend="setSearch(this.value)">
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
function setSearch(v){
  ui.search=v;
  // 每次輸入都重繪清單：只換 #cbody 內容、完全不碰搜尋框本身，
  // 所以注音組字不會被打斷。不再用 isComposing 判斷（手機該旗標不準：
  // 有些瀏覽器選完字的 input 仍回報 isComposing=true，會害結果永遠不更新）。
  const body=document.getElementById('cbody');
  if(body){ body.innerHTML=checkBody(); bindCheck(); }
  else render();
}
