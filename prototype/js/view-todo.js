/* view-todo.js — 待辦頁（即將完課表格 + 器材到期摘要） */
function todoView(){
  const due = DB.students.filter(isDue);
  if(!due.length) return `<div class="empty todo-empty">目前沒有即將上完的學生 🎉</div>`;
  let html = `<div class="addbar"><button class="addstu" onclick="exportTodo()">⬇ 匯出待繳名單</button></div>
    <div class="hint2">點學生即可<b class="t-primary">記繳費</b>（記後已上堂數自動扣方案堂數）</div>
    <table class="dtable todo">
    <colgroup><col><col><col><col></colgroup>
    <thead><tr>
      <th>姓名</th><th>方案</th><th>已上堂數</th><th>備註</th>
    </tr></thead><tbody>`;
  // 依老師分組（老師順序照 DB.teachers，名字不重複）
  activeTeachers().forEach(t=>{
    const list = due.filter(s=>s.t===t.id);
    if(!list.length) return;
    html += `<tr class="ghead"><td colspan="4">${t.name}${t.role} · ${list.length} 位</td></tr>`;
    list.forEach(s=>{
      html += `<tr class="clickable" onclick="openPay('${s.id}')">
        <td class="sname">${s.name}</td>
        <td class="c"><span class="badge ${planClass(s.plan)}">${s.plan}</span></td>
        <td class="c att">${s.attended}</td>
        <td class="note">${s.note||'—'}</td>
      </tr>`;
    });
  });
  html += `</tbody></table>`;
  return html;
}
