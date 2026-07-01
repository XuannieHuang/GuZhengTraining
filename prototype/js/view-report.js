/* view-report.js — 報表（現況總覽 + 月營收 + 繳費明細） */
function monthLabel(ym){ const [y,m]=ym.split('-'); return `${y} 年 ${parseInt(m,10)} 月`; }
function setReportMonth(delta){
  const [y,m]=REPORTS.month.split('-').map(Number);
  const d=new Date(y, m-1+delta, 1);
  REPORTS.month=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
  render();
}
function payTotal(p){ return (p.amount||0)*(p.periods||1); }
async function resumeStudent(id){
  const s=DB.students.find(x=>x.id===id); if(!s) return;
  if(!confirm(`確定將「${s.name}」復課（狀態改回「在學」）？`)) return;
  const { error } = await sb.from('students').update({status:'在學'}).eq('id',id);
  if(error){ toast('復課失敗：'+error.message); return; }
  s.status='在學';
  render(); toast(`${s.name} 已復課（在學）`);
}

function reportView(){
  if(!REPORTS.month) REPORTS.month=today().slice(0,7);
  // ── 現況總覽（即時由目前資料算） ──
  const inschool = DB.students.filter(isActive).length;
  const newbie   = DB.students.filter(s=>s.status==='新生').length;
  const dueCnt   = DB.students.filter(isDue).length;
  const rActive  = DB.rentals.filter(r=>r.status==='租賃中').length;
  const rOver    = DB.rentals.filter(r=>rentalState(r)==='overdue').length;
  const rSoon    = DB.rentals.filter(r=>rentalState(r)==='soon').length;

  let html = `<div class="addbar"><button class="addstu" onclick="openEvents()">✎ 事件修正（補登／改錯／退費）</button></div>
    <div class="section-title">📊 現況總覽</div>
    <div class="stat-grid">
      <div class="stat"><div class="v">${inschool}</div><div class="l">上課中學生（含新生 ${newbie}）</div></div>
      <div class="stat"><div class="v red">${dueCnt}</div><div class="l">本期即將完課待繳</div></div>
      <div class="stat"><div class="v">${rActive}</div><div class="l">器材租賃中</div></div>
      <div class="stat"><div class="v amber">${rOver}+${rSoon}</div><div class="l">器材逾期＋本月到期</div></div>
    </div>`;

  // 各老師在學學生數
  html += `<div class="section-title">各老師在學學生數</div><table class="dtable rpt-t1">
    <colgroup><col><col></colgroup>
    <thead><tr><th>老師</th><th class="c">在學人數</th></tr></thead><tbody>`;
  activeTeachers().forEach(t=>{
    const n=DB.students.filter(s=>s.t===t.id && isActive(s)).length;
    html+=`<tr><td class="sname">${t.name}${t.role}</td><td class="c rpt-count">${n}</td></tr>`;
  });
  html+=`</tbody></table>`;

  // ── 月營收 ──
  html += `<div class="section-title">💰 營收</div>
    <div class="month-nav">
      <button onclick="setReportMonth(-1)">‹</button>
      <span class="ml">${monthLabel(REPORTS.month)}</span>
      <button onclick="setReportMonth(1)">›</button>
    </div>`;

  if(REPORTS.payments===null){
    html += `<div class="empty">載入繳費紀錄中…</div>`;
    return html;
  }

  const pays = REPORTS.payments.filter(p=>(p.pay_date||'').slice(0,7)===REPORTS.month);
  const total = pays.reduce((s,p)=>s+payTotal(p),0);
  html += `<div class="card rev-card"><div class="rev-big">$${total.toLocaleString()}</div>
    <div class="meta">本月 ${pays.length} 筆繳費</div></div>`;

  if(pays.length){
    // 依繳別
    const byBill={};
    pays.forEach(p=>{ const b=p.billing||'其他'; byBill[b]=byBill[b]||{amt:0,n:0}; byBill[b].amt+=payTotal(p); byBill[b].n++; });
    html+=`<table class="dtable rpt-t2"><colgroup><col><col><col></colgroup>
      <thead><tr><th>繳別</th><th class="c">筆數</th><th class="c">金額</th></tr></thead><tbody>`;
    Object.keys(byBill).forEach(b=>{ html+=`<tr><td class="sname">${b}</td><td class="c">${byBill[b].n}</td><td class="c rpt-amt">$${byBill[b].amt.toLocaleString()}</td></tr>`; });
    html+=`</tbody></table>`;

    // 依老師
    const byT={};
    pays.forEach(p=>{ const s=DB.students.find(x=>x.id===p.student_id); const tn=s?(teacherName(s.t)||'未指定'):'未連結';
      byT[tn]=byT[tn]||{amt:0,n:0}; byT[tn].amt+=payTotal(p); byT[tn].n++; });
    html+=`<div class="section-title">依老師</div><table class="dtable rpt-t2"><colgroup><col><col><col></colgroup>
      <thead><tr><th>老師</th><th class="c">筆數</th><th class="c">金額</th></tr></thead><tbody>`;
    Object.keys(byT).forEach(tn=>{ html+=`<tr><td class="sname">${tn}</td><td class="c">${byT[tn].n}</td><td class="c rpt-amt">$${byT[tn].amt.toLocaleString()}</td></tr>`; });
    html+=`</tbody></table>`;

    // 明細
    html+=`<div class="section-title">本月繳費明細</div><table class="dtable rpt-t4">
      <colgroup><col><col><col><col></colgroup>
      <thead><tr><th class="c">日期</th><th>學生</th><th class="c">方案</th><th class="c">金額</th></tr></thead><tbody>`;
    pays.slice().sort((a,b)=>(b.pay_date||'').localeCompare(a.pay_date||'')).forEach(p=>{
      const s=DB.students.find(x=>x.id===p.student_id);
      const amt=payTotal(p);
      html+=`<tr class="clickable" onclick="openPayEvent('${p.id}')"><td class="c">${fmtDate(p.pay_date)}</td><td class="sname">${s?s.name:'—'}</td>
        <td class="c">${p.billing||''}${p.periods>1?'×'+p.periods:''}</td>
        <td class="c rpt-amt-r ${amt<0?'t-red':''}">$${amt.toLocaleString()}</td></tr>`;
    });
    html+=`</tbody></table>`;
  } else {
    html+=`<div class="empty pad20">這個月還沒有繳費紀錄<br><span class="note-sub">（用 App 記的繳費會累積到這裡）</span></div>`;
  }

  // ── 已停課（流失）名單 ──
  const stopped = DB.students.filter(s=>s.status==='停課')
    .sort((a,b)=>(a.pay||'').localeCompare(b.pay||''));
  html += `<div class="section-title">🚪 已停課名單（${stopped.length}）</div>`;
  if(!stopped.length){
    html += `<div class="empty pad16">目前沒有停課學生</div>`;
  } else {
    html += `<table class="dtable rpt-t5">
      <colgroup><col><col><col><col></colgroup>
      <thead><tr><th>姓名</th><th>老師</th><th class="c">最後繳費</th><th class="c">操作</th></tr></thead><tbody>`;
    stopped.forEach(s=>{
      html += `<tr><td class="sname">${s.name}</td><td>${teacherName(s.t)||'—'}</td><td class="c">${fmtDate(s.pay)}</td>
        <td class="c"><button class="resume-btn" onclick="resumeStudent('${s.id}')">↩ 復課</button></td></tr>`;
    });
    html += `</tbody></table>`;
  }

  // ── 資料匯出（CSV） ──
  html += `<div class="section-title">📥 資料匯出（CSV）</div>
    <div class="exp-row">
      <button class="exp-btn" onclick="exportPayments()">⬇ 繳費明細</button>
      <button class="exp-btn" onclick="exportRentals()">⬇ 租借清單</button>
    </div>
    <div class="meta set-note">匯出含全部紀錄；用 Excel／Google 試算表開即可。</div>`;
  return html;
}
