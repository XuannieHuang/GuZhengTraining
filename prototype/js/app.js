/* app.js — 外殼：render()、導覽、全域匯出、啟動（最後載入） */
function render(){
  const app=document.getElementById('app');
  if(ui.screen==='login'){ app.innerHTML=loginView(); bindLogin(); return; }
  if(ui.screen==='denied'){ app.innerHTML=deniedView(); return; }
  const dueCount = DB.students.filter(isDue).length;
  const rentOver = DB.rentals.filter(r=>rentalState(r)==='overdue').length;
  const rentSoon = DB.rentals.filter(r=>rentalState(r)==='soon').length;
  const rentAlert = rentOver + rentSoon;
  const titles={todo:'本期待辦',check:'上課核對',rental:'器材租借',report:'報表',events:'事件修正',setting:'設定'};
  const subHtml = ui.screen==='todo'
    ? `<span class="tdot"></span>本期即將完課 ${dueCount} 位`
    : ui.screen==='rental'
    ? `<span class="tdot"></span>逾期 ${rentOver} · 本月到期 ${rentSoon}`
    : '';
  app.innerHTML = `
    <header>
      <span class="ava">${(ME||'?').slice(0,1).toUpperCase()}</span>
      <h1>${titles[ui.screen]||''}</h1>
      ${subHtml?`<div class="sub">${subHtml}</div>`:''}
    </header>
    <main>${ ui.screen==='todo'?todoView() : ui.screen==='check'?checkView() : ui.screen==='rental'?rentalView() : ui.screen==='report'?reportView() : ui.screen==='events'?eventsView() : settingView() }</main>
    <nav>
      <button class="${ui.screen==='todo'?'active':''}" onclick="go('todo')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/></svg>待辦${dueCount?`<span class="navbadge">${dueCount}</span>`:''}</button>
      <button class="${ui.screen==='check'?'active':''}" onclick="go('check')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 13l5 5L20 6"/></svg>核對</button>
      <button class="${ui.screen==='rental'?'active':''}" onclick="go('rental')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8l8-4 8 4-8 4-8-4Z"/><path d="M4 8v8l8 4 8-4V8"/></svg>租借${rentAlert?`<span class="navbadge">${rentAlert}</span>`:''}</button>
      <button class="${ui.screen==='report'?'active':''}" onclick="go('report')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V10M12 20V4M19 20v-7"/></svg>報表</button>
      <button class="${ui.screen==='setting'?'active':''}" onclick="go('setting')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg>設定</button>
    </nav>`;
  if(ui.screen==='check') bindCheck();
}
function go(s){ ui.screen=s; render(); if(s==='report' && REPORTS.payments===null) loadReportData(); }

/* ---------- 全域匯出（供 inline onclick 使用） ---------- */
window.go=go; window.doLogin=doLogin; window.setTab=setTab; window.setSearch=setSearch;
window.openSearch=openSearch; window.closeSearch=closeSearch;
window.openPay=openPay; window.closePay=closePay; window.confirmPay=confirmPay;
window.setPlan=setPlan; window.setPeriods=setPeriods; window.logout=logout; window.ui=ui;
window.googleLogin=googleLogin; window.addAllowed=addAllowed; window.removeAllowedEmail=removeAllowedEmail;
window.setAmt=setAmt;
window.openPlan=openPlan; window.pfield=pfield; window.closePlan=closePlan; window.savePlan=savePlan; window.deletePlan=deletePlan;
window.openStudent=openStudent; window.sfield=sfield; window.closeStudent=closeStudent; window.saveStudent=saveStudent;
window.pfld=pfld; window.payFromStudent=payFromStudent;
window.toggleTeacher=toggleTeacher; window.toggleShowInact=toggleShowInact;
window.openTeacher=openTeacher; window.tfield=tfield; window.tInst=tInst; window.closeTeacher=closeTeacher; window.saveTeacher=saveTeacher;
window.setRentTab=setRentTab; window.openRental=openRental; window.rfield=rfield;
window.closeRental=closeRental; window.saveRental=saveRental; window.renewRental=renewRental;
window.deleteRental=deleteRental; window.deleteRentalLog=deleteRentalLog;
window.setReportMonth=setReportMonth; window.resumeStudent=resumeStudent;
window.clearAllChecks=clearAllChecks; window.exportPayments=exportPayments; window.exportRentals=exportRentals; window.exportTodo=exportTodo;
window.openEvents=openEvents; window.setEvFilter=setEvFilter; window.setEvSearch=setEvSearch;
window.openPayEvent=openPayEvent; window.peField=peField; window.peTotal=peTotal;
window.closePayEvent=closePayEvent; window.savePayEvent=savePayEvent; window.deletePayEvent=deletePayEvent; window.refundPayEvent=refundPayEvent;

/* ---------- 啟動：已登入就直接進 App ---------- */
async function boot(){
  try{
    const { data:{ session } } = await sb.auth.getSession();
    if(session){
      MY_EMAIL=session.user.email||''; ME=MY_EMAIL.split('@')[0];
      const gate = await loadAllowed();      // 白名單把關
      if(gate==='denied'){ ui.screen='denied'; }
      else { await loadAll(); ui.screen='todo'; }
    }
  }catch(e){ ui.loginMsg='連線/讀取失敗：'+e.message; }
  render();
}
boot();
