/* export.js — 資料匯出 CSV（Excel 可開，含 UTF-8 BOM 處理中文） */
function downloadCSV(filename, rows){
  const esc=v=>{ v=(v==null?'':String(v)); return /[",\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v; };
  const csv='﻿'+rows.map(r=>r.map(esc).join(',')).join('\r\n');   // BOM 讓 Excel 正確顯示中文
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportPayments(){
  if(REPORTS.payments===null){ toast('繳費資料載入中，請稍候再按一次'); loadReportData(); return; }
  if(!REPORTS.payments.length){ toast('沒有繳費紀錄可匯出'); return; }
  const rows=[['日期','學生','老師','方案','期數','金額/期','合計']];
  REPORTS.payments.slice().sort((a,b)=>(b.pay_date||'').localeCompare(a.pay_date||'')).forEach(p=>{
    const s=DB.students.find(x=>x.id===p.student_id);
    rows.push([p.pay_date||'', s?s.name:'（已刪除）', s?(teacherName(s.t)||''):'', p.billing||'',
      p.periods||1, p.amount||0, (p.amount||0)*(p.periods||1)]);
  });
  downloadCSV(`繳費明細_${today()}.csv`, rows);
  toast('已匯出繳費明細 CSV');
}
function exportTodo(){
  const due=DB.students.filter(isDue);
  if(!due.length){ toast('目前沒有待繳學生'); return; }
  const rows=[['老師','姓名','方案','已上堂數','備註']];
  activeTeachers().forEach(t=>{
    due.filter(s=>s.t===t.id).forEach(s=>{ rows.push([t.name+t.role, s.name, s.plan||'', s.attended||0, s.note||'']); });
  });
  // 含老師已停用的「待指派」待繳生，避免漏催
  due.filter(s=>!activeTeachers().find(t=>t.id===s.t)).forEach(s=>{ rows.push(['（未指派）', s.name, s.plan||'', s.attended||0, s.note||'']); });
  downloadCSV(`待繳名單_${today()}.csv`, rows);
  toast('已匯出待繳名單 CSV');
}
function exportRentals(){
  if(!DB.rentals.length){ toast('沒有租借紀錄可匯出'); return; }
  const rows=[['承租人','樂器','方案','繳費日','起租日','到期日','還箏日','狀態','備註']];
  DB.rentals.slice()
    .sort((a,b)=>(a.status||'').localeCompare(b.status||'') || (a.due||'9999').localeCompare(b.due||'9999'))
    .forEach(r=>{ rows.push([r.name||'', r.inst||'', r.billing||'', r.pay||'', r.start||'', r.due||'', r.returned||'', r.status||'', r.note||'']); });
  downloadCSV(`租借清單_${today()}.csv`, rows);
  toast('已匯出租借清單 CSV');
}
