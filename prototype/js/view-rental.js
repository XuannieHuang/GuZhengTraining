/* view-rental.js — 器材租借頁（清單） */
function rentalView(){
  const showReturned = ui.rentTab==='returned';
  let list = DB.rentals.filter(r=> showReturned ? r.status==='已還箏' : r.status==='租賃中');
  list.sort((a,b)=> (a.due||'9999')<(b.due||'9999')?-1:1);
  const activeCnt = DB.rentals.filter(r=>r.status==='租賃中').length;
  let html=`<div class="rtabs">
      <button class="rtab ${!showReturned?'active':''}" onclick="setRentTab('active')">租賃中 ${activeCnt}</button>
      <button class="rtab ${showReturned?'active':''}" onclick="setRentTab('returned')">已還箏</button>
    </div>
    <div class="addbar"><button class="addstu" onclick="openRental(null)">＋ 新增租借</button></div>`;
  if(!showReturned) html+=`<div class="hint2">點任一筆可續租／還箏（逾期／本月到期統計見上方標題）</div>`;
  if(!list.length){ html+=`<div class="empty">${showReturned?'沒有已還箏紀錄':'目前沒有租賃中的器材'}</div>`; return html; }
  html+=`<table class="dtable rtable">
    <colgroup><col><col><col><col></colgroup>
    <thead><tr><th>姓名</th><th class="c">起租日</th><th class="c">${showReturned?'還箏日':'到期日'}</th><th class="c">狀態</th></tr></thead><tbody>`;
  // 依器材分組（古箏優先）
  const insts=[...new Set(list.map(r=>r.inst))].sort((a,b)=> (a==='古箏'?0:1)-(b==='古箏'?0:1) || (a||'').localeCompare(b||''));
  insts.forEach(inst=>{
    const grp=list.filter(r=>r.inst===inst);
    html+=`<tr class="ghead"><td colspan="4">${inst} · ${grp.length} 位</td></tr>`;
    grp.forEach(r=>{
      const st=rentalState(r);
      const dueCls = st==='overdue'?'due-over':(st==='soon'?'due-soon':'');
      const pill = st==='overdue'?'<span class="rst rst-over">逾期</span>'
                 : st==='soon'?'<span class="rst rst-soon">本月到期</span>'
                 : st==='returned'?'<span class="rst rst-done">已還</span>'
                 : '<span class="rst rst-active">租賃中</span>';
      html+=`<tr onclick="openRental('${r.id}')">
        <td class="sname">${r.name||'—'}${r.note?`<div class="meta">${r.note}</div>`:''}</td>
        <td class="c">${fmtDate(r.start)}</td>
        <td class="c ${dueCls}">${fmtDate(showReturned?r.returned:r.due)}</td>
        <td class="c">${pill}</td>
      </tr>`;
    });
  });
  html+=`</tbody></table>`;
  return html;
}
function setRentTab(v){ ui.rentTab=v; render(); }
