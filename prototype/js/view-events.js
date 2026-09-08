/* view-events.js — 事件修正頁：查找並修正繳費／租箏紀錄（補登／改錯／退費／續租／還箏） */
function openEvents(){ ui.screen='events'; if(REPORTS.payments===null) loadReportData(); render(); }
function eventsView(){
  const f=ui.evFilter||'all', q=(ui.evSearch||'').trim();
  let items=[];
  if(f!=='rent' && REPORTS.payments){
    REPORTS.payments.forEach(p=>{ const s=DB.students.find(x=>x.id===p.student_id);
      items.push({ kind:'pay', id:p.id, date:p.pay_date||'', name:s?s.name:'（已刪除）',
        detail:`${p.billing||''}${p.periods>1?' ×'+p.periods:''}`, amount:(p.amount||0)*(p.periods||1) }); });
  }
  if(f!=='pay'){
    DB.rentals.forEach(r=>{ items.push({ kind:'rent', id:r.id, date:r.pay||r.start||'', name:r.name||'—',
      detail:`${r.inst} · ${r.status}`, amount:null }); });
  }
  if(q) items=items.filter(i=>i.name.includes(q));
  items.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const cap=120, shown=items.slice(0,cap);
  const fchip=(v,l)=>`<div class="chipbtn ${f===v?'sel':''}" onclick="setEvFilter('${v}')">${l}</div>`;
  let html=`<div class="ev-top">
      <button class="ev-back" onclick="go('report')">‹ 返回</button>
      <div class="section-title">✎ 事件修正</div>
    </div>
    <div class="hint2">補登／改錯／退費 — 點任一筆<b>繳費</b>可改金額·日期·刪除·退費；點<b>租箏</b>可改租期·續租·還箏。</div>
    <div class="chips ev-filter">${fchip('all','全部')}${fchip('pay','💲 繳費')}${fchip('rent','🎻 租箏')}</div>
    <input class="searchbox" placeholder="🔍 搜尋學生／承租人姓名" value="${ui.evSearch||''}" oninput="setEvSearch(this.value,event)" oncompositionend="setEvSearch(this.value,null)">`;
  if(REPORTS.payments===null && f!=='rent'){ html+=`<div class="empty">載入繳費紀錄中…</div>`; return html; }
  if(!shown.length){ html+=`<div class="empty">沒有符合的事件</div>`; return html; }
  html+=`<div class="ev-list">`;
  shown.forEach(i=>{
    const click = i.kind==='pay' ? `openPayEvent('${i.id}')` : `openRental('${i.id}')`;
    const right = i.amount!=null
      ? `<b class="ev-amt ${i.amount<0?'t-red':''}">$${i.amount.toLocaleString()}</b>`
      : `<span class="ev-go">›</span>`;
    html+=`<div class="ev-row" onclick="${click}">
      <div class="ev-date">${fmtDate(i.date)}</div>
      <div class="ev-mid"><div class="ev-name">${i.kind==='pay'?'💲':'🎻'} ${i.name}</div><div class="meta">${i.detail}</div></div>
      ${right}</div>`;
  });
  html+=`</div>`;
  if(items.length>cap) html+=`<div class="empty sm">只顯示最近 ${cap} 筆，用搜尋縮小範圍</div>`;
  return html;
}
function setEvFilter(v){ ui.evFilter=v; render(); }
function setEvSearch(v,e){ ui.evSearch=v; if(e && e.isComposing) return; render(); const inp=document.querySelector('.searchbox'); if(inp){ inp.focus(); inp.setSelectionRange(v.length,v.length); } }
