/* view-settings.js — 設定頁（方案價、老師啟停用、管理者、登出） */
function settingView(){
  if(isDesk()) return deskSettingView();      // 桌機版：卡片列改表格（js/desktop.js）
  const order=(p)=>(p.instrument||'').localeCompare(p.instrument||'')*0 + ({'個人':0,'團體':1,'雙人':2}[p.class_type]??9)*10 + (p.billing==='月繳'?0:1);
  const plans=PLANS.slice().sort((a,b)=> (a.instrument+'').localeCompare(b.instrument+'') || order(a)-order(b));
  return `<div class="set-head"><div class="section-title">方案及價格</div><button class="set-addbtn" onclick="openPlan(null)">＋ 新增課程方案</button></div>
    ${plans.map(p=>`<div class="card setrow" onclick="openPlan('${p.id}')"><div class="row">
      <div class="grow">${p.instrument} · ${p.class_type} · ${p.billing} <span class="meta">${p.sessions} 堂</span></div>
      <b>$${(p.price||0).toLocaleString()}</b></div></div>`).join('')}
    <div class="set-head"><div class="section-title">任課老師（在職 ${activeTeachers().length}）</div><button class="set-addbtn" onclick="openTeacher(null)">＋ 新增老師</button></div>
    ${DB.teachers.filter(t=>t.active!==false).map(teacherCard).join('')}
    ${(function(){ const inact=DB.teachers.filter(t=>t.active===false); if(!inact.length) return '';
      return `<a class="resetlink" onclick="toggleShowInact()">${ui.showInact?'▲ 收起已停用':'▾ 顯示已停用（'+inact.length+'）'}</a>
        ${ui.showInact ? inact.map(teacherCard).join('') : ''}`; })()}
    ${booksSection()}
    <div class="set-head"><div class="section-title">管理者白名單${ALLOWED.length?'（'+ALLOWED.length+'）':''}</div><button class="set-addbtn" onclick="addAllowed()">＋ 新增 Email</button></div>
    ${ALLOWED.length ? ALLOWED.map(allowedCard).join('')
      : `<div class="card"><div class="mgr">
          <div class="avatar">${(MY_EMAIL||'?').slice(0,1).toUpperCase()}</div>
          <div class="grow"><b>${MY_EMAIL||'—'}</b><div class="meta">目前登入中</div></div>
          <span class="badge pipa">管理者</span></div></div>
         <div class="meta set-note">＊白名單尚未啟用（請先在 Supabase 執行 C1 SQL）。</div>`}
    <a class="resetlink" onclick="logout()">登出</a>
    <div class="empty sm">雲端版 · Supabase</div>`;
}
function allowedCard(a){
  const me = a.email.toLowerCase()===(MY_EMAIL||'').toLowerCase();
  return `<div class="card"><div class="mgr">
    <div class="avatar">${a.email.slice(0,1).toUpperCase()}</div>
    <div class="grow"><b>${a.email}</b>${me?'<div class="meta">目前登入中</div>':(a.note?`<div class="meta">${a.note}</div>`:'')}</div>
    ${me ? '<span class="badge pipa">本人</span>'
         : `<button class="tbtn off" onclick="removeAllowedEmail('${a.email}')">移除</button>`}
  </div></div>`;
}
function addAllowed(){
  const email = prompt('輸入要加入白名單的 Email（對方用 Google 登入的 Gmail）：');
  if(email && email.trim()) addAllowedEmail(email);
}
function teacherCard(t){
  return `<div class="card ${t.active?'':'inactive'}"><div class="mgr">
    <div class="avatar ${t.active?'':'off'}" onclick="openTeacher('${t.id}')">${t.name.slice(0,1)}</div>
    <div class="grow clickable" onclick="openTeacher('${t.id}')"><b>${t.name}</b> <span class="badge ${t.role==='主任'?'pipa':''}">${t.role}</span>
      ${t.active?'':'<span class="badge">已停用</span>'}<div class="meta">${t.inst.join('、')}</div></div>
    <button class="tbtn ${t.active?'off':'on'}" onclick="event.stopPropagation();toggleTeacher('${t.id}')">${t.active?'停用':'啟用'}</button>
  </div></div>`;
}
function toggleShowInact(){ ui.showInact=!ui.showInact; render(); }
function toggleTeacher(id){
  const t=DB.teachers.find(x=>x.id===id); if(!t) return;
  if(t.active){ // 即將停用 → 若名下有在學學生，提示（列出姓名）
    const studs=DB.students.filter(s=>s.t===id && isActive(s));
    if(studs.length){
      const names=studs.map(s=>s.name).join('、');
      if(!confirm(`${t.name} 名下還有 ${studs.length} 位在學學生：\n${names}\n\n停用後請到核對頁的「⚠ 待指派」分頁，把他們改派給在職老師。\n\n仍要停用嗎？`)) return;
    }
  }
  t.active=!t.active;
  sb.from('teachers').update({active:t.active}).eq('id',id).then(({error})=>{ if(error) toast('儲存失敗：'+error.message); });
  render(); toast(`${t.name} 已${t.active?'啟用':'停用'}`);
}

/* 課本區段（手機版）：卡片列，依書名排。
   書不綁定存放位置 —— 同一本常常分散在兩三個地方，綁上去那個標籤就會說謊。
   位置只在盤點時當動線用。桌機版在 js/desktop.js，改成表格。 */
function booksSection(){
  const list=DB.books.slice().sort((a,b)=>a.name.localeCompare(b.name));
  const head=`<div class="set-head"><div class="section-title">課本（${list.length}）</div>
    <div class="row" style="gap:6px">
      ${list.length?`<button class="set-addbtn" onclick="openStocktake()">📋 盤點</button>`:''}
      <button class="set-addbtn" onclick="openBook(null)">＋ 新增課本</button>
    </div></div>`;
  if(!list.length) return head+`<div class="empty sm">尚未建立課本</div>`;
  return head + list.map(b=>`<div class="card setrow" onclick="openBook('${b.id}')"><div class="row">
      ${bookThumb(b)}
      <div class="grow"><b>${b.name}</b>${b.note?`<div class="meta">${b.note}</div>`:''}</div>
      <div class="tac"><div class="bqty">${b.qty}</div>
        <div class="meta">${b.price!=null?'$'+b.price.toLocaleString():'—'}</div></div>
    </div></div>`).join('');
}
