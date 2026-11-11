/* desktop.js — 桌機版面（≥1024px）
 *
 * 手機是這個 App 的主場，桌機只是偶爾用。所以這支的規則是：
 * 低於 1024px 一律回到原本的手機程式，這裡的任何函式都不會被呼叫到。
 *
 * 分頁跟手機完全一樣（待辦／核對／租借／報表／設定五頁），不一樣的只有版面：
 *   1. 導覽從底部橫列改成頂部一行。
 *   2. 表格欄位貼合內容（手機是固定欄寬，寬螢幕照用會把空白平均分給每一欄），
 *      並補上手機放不下的欄位：待辦補「老師」「上次繳費」、租借補「樂器」「方案」「備註」。
 *   3. 核對頁的老師頁籤改成表格裡的分組列 —— 所有老師一次看得到，不用一個一個點。
 *      待核對／已核對的分法與「核過自動下移」完全比照手機。
 *   4. 彈窗改成右欄的詳情面板。
 */

function isDesk(){ return matchMedia('(min-width: 1024px)').matches; }
/* 曾經把面板的門檻另訂在 1280，理由是「1024–1279 同時放表格跟面板會太擠」。
   實際用起來是錯的：系統縮放 125% 的螢幕 CSS 寬度就落在這一段，
   結果詳情又變回蓋住整個畫面的彈窗。表格擠一點沒關係，
   有空白就要放詳情 —— 所以跟桌機版同一個門檻。 */
function isPanel(){ return isDesk(); }

/* ── 右欄 ───────────────────────────────────────────────────
   render() 會整塊重寫 #app.innerHTML，所以右欄的節點要留在變數裡，
   重繪後再接回去 —— 面板裡開著的詳情才不會被一起清掉。 */
let SIDE = null;
function sideEl(){
  if(!SIDE){ SIDE=document.createElement('aside'); SIDE.id='side'; }
  return SIDE;
}
function mountSide(app){
  if(!isDesk()) return;
  app.appendChild(sideEl());
}

/* 6 個彈窗共用的掛載點：寬螢幕掛進右欄，其餘維持原本的 document.body。

   右欄一次只放一筆。唯一的例外是「從學生面板的繳費紀錄點進某一筆去改」——
   那是真正的巢狀（改完要退回原本那位學生），CSS 只顯示最後一層。
   其他情況（例如在事件修正頁先點一筆繳費、再點一筆租箏）是「換一筆看」，
   不清掉的話關掉上面那層會冒出前一筆，看起來就像疊在一起。 */
const HOST_IDS = ['ov','sov','rov','tov','pov','peov'];
const HOST_UI  = { ov:'modal', sov:'smodal', rov:'rmodal', tov:'tmodal', pov:'pmodal', peov:'pemodal' };
function dropHost(id){
  const h=document.getElementById(id); if(h) h.remove();
  if(typeof ui!=='undefined') ui[HOST_UI[id]]=null;
}
function modalHost(id){
  let host=document.getElementById(id);
  if(!host){ host=document.createElement('div'); host.id=id; }
  const parent = isPanel() ? sideEl() : document.body;
  if(isPanel()){
    // 巢狀只認這一組：學生 → 他的某一筆繳費
    const keep = (id==='peov' && document.getElementById('sov')) ? ['sov', id] : [id];
    HOST_IDS.forEach(x=>{ if(keep.indexOf(x)<0 && document.getElementById(x)) dropHost(x); });
  }
  if(host.parentNode!==parent) parent.appendChild(host);
  return host;
}
/* 跨斷點時把已經開著的詳情搬到正確的位置 */
function rehomeModals(){
  HOST_IDS.forEach(id=>{ if(document.getElementById(id)) modalHost(id); });
}
/* 換頁時要把右欄清乾淨。
   手機的彈窗有遮罩蓋住導覽、根本點不到分頁；桌機的分頁一直可以點，
   不關掉的話換頁之後上一頁的詳情還黏在右欄。
   走各自的 closeXxx()（而不是直接 remove）才會一起把 ui 狀態清掉。 */
function closeSidePanels(){
  if(typeof ui==='undefined') return;
  if(ui.pemodal) closePayEvent();
  if(ui.smodal)  closeStudent();
  if(ui.modal)   closePay();
  if(ui.rmodal)  closeRental();
  if(ui.tmodal)  closeTeacher();
  if(ui.pmodal)  closePlan();
}

/* ── 核對頁 ───────────────────────────────────────────────
   老師頁籤 → 表格分組列；待核對／已核對的分法與自動下移比照手機。 */
const DESK_CHK_COLS = 6;

function deskStudentRow(s){
  const due=isDue(s);
  return `<tr class="${s.checked?'checked':''} ${due?'due':''}">
    <td class="c-chk"><div class="chk ${s.checked?'on':''}" data-act="chk" data-id="${s.id}">✓</div></td>
    <td class="sname"><span class="ename" data-act="edit" data-id="${s.id}">${s.name}</span>${
      // 雙人組放第二行：跟姓名同一行的話，整欄寬度會被它撐開，
      // 沒配對的人姓名旁邊就空一大塊
      s.type==='雙人'?`<div class="dualline"><span class="badge dual">👥 ${s.partner?studentName(s.partner):'未配對'}</span></div>`:''}</td>
    <td class="c"><span class="badge ${planClass(s.plan)}">${s.plan}</span></td>
    <td class="c"><div class="numwrap">
      <input class="num ${due?'due':''}" type="number" inputmode="numeric" value="${s.attended}" data-act="num" data-id="${s.id}">
      <button class="signbtn" data-act="sign" data-id="${s.id}" title="正負切換">±</button></div></td>
    <td class="c">${fmtDate(s.pay)}</td>
    <td class="note">${s.note||'—'}</td>
  </tr>`;
}

function deskCheckGroup(title, list, teacherId){
  if(!list.length) return '';
  const pending = list.filter(s=>!s.checked);
  const done    = list.filter(s=>s.checked);
  const add = teacherId
    ? `<button class="ghead-add" onclick="addStudentFor('${teacherId}')">＋ 新增</button>` : '';
  let h = `<tr class="ghead"><td colspan="${DESK_CHK_COLS}">`
        + `<span>${title} · ${list.length} 位 · 已核對 ${done.length}</span>${add}</td></tr>`;
  h += pending.length ? pending.map(deskStudentRow).join('')
     : `<tr class="gsub done"><td colspan="${DESK_CHK_COLS}">都核對完成 🎉</td></tr>`;
  if(done.length){
    // 已核對的往下移，上面的待核對清單越來越短 —— 跟手機的兩張卡同一個用意
    h += `<tr class="gsub"><td colspan="${DESK_CHK_COLS}">已核對 ${done.length}</td></tr>`
       + done.map(deskStudentRow).join('');
  }
  return h;
}

/* 清單主體：搜尋時只重繪這塊（不動搜尋框，避免打斷注音組字） */
function deskCheckBody(){
  const q=(ui.search||'').trim();
  let list = DB.students.filter(isActive);
  if(q) list = list.filter(s=>s.name.includes(q));
  if(!list.length) return `<div class="empty">${q?`找不到「${q}」的在學/新生學生`:'目前沒有上課中的學生'}</div>`;

  const ats=activeTeachers();
  let rows='';
  ats.forEach(t=>{ rows += deskCheckGroup(t.name+t.role, list.filter(s=>s.t===t.id), t.id); });
  const orph = list.filter(s=>!ats.find(t=>t.id===s.t));
  if(orph.length) rows += deskCheckGroup('⚠ 待指派（老師已停用，請點姓名改指派）', orph, null);

  return `<table class="dtable dk-table"><thead><tr>
      <th></th><th>姓名</th><th class="c">方案</th><th class="c">已上堂數</th>
      <th class="c">上次繳費</th><th class="col-note">備註</th>
    </tr></thead><tbody>${rows}</tbody></table>`;
}

function deskCheckView(){
  const done=DB.students.filter(s=>s.checked).length;
  return `<div class="dk-bar">
      <input class="dk-search" placeholder="搜尋學生姓名（跨所有老師）" value="${ui.search||''}"
             oninput="setSearch(this.value)" oncompositionend="setSearch(this.value)">
      <div class="dk-prog">本梯已核對 <b>${done}</b>${
        done?` · <span class="nr-clr" onclick="clearAllChecks()">清除·開始新一梯</span>`:''}</div>
    </div><div id="cbody">${deskCheckBody()}</div>`;
}

/* 分組列上的「＋新增」：桌機沒有老師頁籤，ui.tab 不能當預設老師用，
   不先指定的話新學生會被掛到一位跟當下情境無關的老師底下。 */
function addStudentFor(tid){ ui.tab=tid; openStudent(null); }

/* ── 待辦頁 ───────────────────────────────────────────────
   手機是「依老師分組」，桌機寬度夠，老師改成一欄，另補上次繳費。
   點任一列開右邊的學生詳情（記一筆繳費就在裡面），不另開記繳費彈窗。 */
function deskTodoView(){
  const due = DB.students.filter(isDue);
  if(!due.length) return `<div class="empty todo-empty">目前沒有即將上完的學生 🎉</div>`;
  let h = `<div class="dk-bar">
      <button class="dk-add" onclick="exportTodo()">⬇ 匯出待繳名單</button>
      <div class="dk-prog">本期即將完課 <b>${due.length}</b> 位</div>
    </div>
    <table class="dtable dk-table dk-todo"><thead><tr>
      <th>姓名</th><th>老師</th><th class="c">方案</th><th class="c">已上堂數</th>
      <th class="c">上次繳費</th><th class="col-note">備註</th>
    </tr></thead><tbody>`;
  due.forEach(s=>{
    h += `<tr class="clickable" onclick="openStudent('${s.id}')">
      <td class="sname">${s.name}</td>
      <td>${teacherName(s.t)||'未指派'}</td>
      <td class="c"><span class="badge ${planClass(s.plan)}">${s.plan}</span></td>
      <td class="c att">${s.attended}</td>
      <td class="c">${fmtDate(s.pay)}</td>
      <td class="note">${s.note||'—'}</td></tr>`;
  });
  return h + `</tbody></table>`;
}

/* ── 器材租借：同一套做法，另補樂器、方案、備註三欄 ─────────── */
function deskRentalView(){
  const showReturned = ui.rentTab==='returned';
  const list=DB.rentals.filter(r=> showReturned ? r.status==='已還箏' : r.status==='租賃中')
                       .sort((a,b)=> (a.due||'9999')<(b.due||'9999')?-1:1);
  const activeCnt=DB.rentals.filter(r=>r.status==='租賃中').length;
  const doneCnt  =DB.rentals.filter(r=>r.status==='已還箏').length;
  const over=DB.rentals.filter(r=>rentalState(r)==='overdue').length;
  const soon=DB.rentals.filter(r=>rentalState(r)==='soon').length;
  let h=`<div class="dk-bar">
      <button class="dk-f ${!showReturned?'on':''}" onclick="setRentTab('active')">租賃中 <b>${activeCnt}</b></button>
      <button class="dk-f ${showReturned?'on':''}" onclick="setRentTab('returned')">已還箏 <b>${doneCnt}</b></button>
      <button class="dk-add" onclick="openRental(null)">＋ 新增租借</button>
      <div class="dk-prog">逾期 <b>${over}</b> · 本月到期 <b>${soon}</b></div>
    </div>`;
  if(!list.length) return h+`<div class="empty">${showReturned?'沒有已還箏紀錄':'目前沒有租賃中的器材'}</div>`;
  h+=`<table class="dtable rtable"><thead><tr><th>姓名</th><th class="c">樂器</th><th class="c">方案</th>
      <th class="c">起租日</th><th class="c">${showReturned?'還箏日':'到期日'}</th>
      <th class="c">狀態</th><th class="col-note">備註</th></tr></thead><tbody>`;
  list.forEach(r=>{
    const st=rentalState(r);
    const dueCls = st==='overdue'?'due-over':(st==='soon'?'due-soon':'');
    const pill = st==='overdue'?'<span class="rst rst-over">逾期</span>'
               : st==='soon'?'<span class="rst rst-soon">本月到期</span>'
               : st==='returned'?'<span class="rst rst-done">已還</span>'
               : '<span class="rst rst-active">租賃中</span>';
    h+=`<tr onclick="openRental('${r.id}')">
      <td class="sname">${r.name||'—'}</td>
      <td class="c">${r.inst||'—'}</td>
      <td class="c"><span class="badge ${planClass(r.billing)}">${r.billing||'—'}</span></td>
      <td class="c">${fmtDate(r.start)}</td>
      <td class="c ${dueCls}">${fmtDate(showReturned?r.returned:r.due)}</td>
      <td class="c">${pill}</td>
      <td class="note">${r.note||'—'}</td></tr>`;
  });
  return h+`</tbody></table>`;
}

/* ── 事件修正 ─────────────────────────────────────────────
   手機是一列一張小卡（日期｜💲/🎻 姓名｜方案·狀態｜金額｜›）。
   桌機改成表格，另補「老師」一欄（原本完全看不到，要修某位老師的帳得自己記），
   日期改成完整年月日 —— 這一頁常要翻去年的帳，只有月日會分不清。
   跟報表的「本月繳費明細」是同一批資料的兩個入口，改完兩邊長得一樣。 */
function deskEventsView(){
  const f=ui.evFilter||'all';
  const nPay=(REPORTS.payments||[]).length, nRent=DB.rentals.length;
  const chip=(v,l,n)=>`<button class="dk-f ${f===v?'on':''}" onclick="setEvFilter('${v}')">${l} <b>${n}</b></button>`;
  return `<div class="dk-bar">
      <button class="dk-add" onclick="go('report')">‹ 返回報表</button>
      ${chip('all','全部',nPay+nRent)}${chip('pay','💲 繳費',nPay)}${chip('rent','🎻 租箏',nRent)}
      <input class="dk-search" placeholder="搜尋學生／承租人姓名" value="${ui.evSearch||''}"
             oninput="setEvSearch(this.value)" oncompositionend="setEvSearch(this.value)">
    </div><div id="evbody">${deskEventsBody()}</div>`;
}
function deskEventsBody(){
  const f=ui.evFilter||'all', q=(ui.evSearch||'').trim();
  let items=[];
  if(f!=='rent' && REPORTS.payments){
    REPORTS.payments.forEach(p=>{
      const s=DB.students.find(x=>x.id===p.student_id);
      items.push({ kind:'pay', id:p.id, date:p.pay_date||'', name:s?s.name:'（已刪除）',
        tch:s?(teacherName(s.t)||'未指派'):'—',
        detail:`${p.billing||''}${p.periods>1?' ×'+p.periods:''}`,
        amount:(p.amount||0)*(p.periods||1) });
    });
  }
  if(f!=='pay'){
    DB.rentals.forEach(r=>items.push({ kind:'rent', id:r.id, date:r.pay||r.start||'',
      name:r.name||'—', tch:rentalTeacher(r)||'—', detail:`${r.inst} · ${r.status}`, amount:null }));
  }
  if(q) items=items.filter(i=>i.name.includes(q));
  items.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  if(REPORTS.payments===null && f!=='rent') return `<div class="empty">載入繳費紀錄中…</div>`;
  const cap=120, shown=items.slice(0,cap);
  if(!shown.length) return `<div class="empty">沒有符合的事件</div>`;
  const rows=shown.map(i=>{
    const click = i.kind==='pay' ? `openPayEvent('${i.id}')` : `openRental('${i.id}')`;
    return `<tr class="clickable" onclick="${click}">
      <td class="c">${fmtDate2(i.date)}</td>
      <td class="c"><span class="badge ${i.kind==='pay'?'j':'pipa'}">${i.kind==='pay'?'💲 繳費':'🎻 租箏'}</span></td>
      <td class="sname">${i.name}</td>
      <td>${i.tch}</td>
      <td>${i.detail}</td>
      <td class="c">${i.amount!=null
        ? `<b class="${i.amount<0?'t-red':'t-primary'}">$${i.amount.toLocaleString()}</b>` : '—'}</td>
    </tr>`;
  }).join('');
  return `<table class="dtable ev-tbl"><thead><tr>
      <th class="c">日期</th><th class="c">類型</th><th>姓名</th><th>老師</th>
      <th>內容</th><th class="c">金額</th>
    </tr></thead><tbody>${rows}</tbody></table>
    ${items.length>cap?`<div class="empty sm">只顯示最近 ${cap} 筆，用搜尋縮小範圍</div>`:''}`;
}

/* ── 設定頁 ───────────────────────────────────────────────
   手機是三段卡片列一路往下排。桌機維持同樣的順序與結構（不另外做子選單 ——
   一共只有三組、十來列，為這點量多一層導覽不划算），只把卡片列換成表格：
     · 方案的「樂器·類型·繳別·堂數」原本黏成一行，拆成欄位才掃得動
     · 老師表補上「在學學生數」—— 現在要知道某位老師帶幾個人得跑去報表看
     · 「編輯／停用」做成列上的按鈕，不用點進去才知道能做什麼 */
function deskSettingPlans(){
  const order=(p)=>({'個人':0,'團體':1,'雙人':2}[p.class_type]??9)*10 + (p.billing==='月繳'?0:1);
  const rows=PLANS.slice().sort((a,b)=>(a.instrument+'').localeCompare(b.instrument+'')||order(a)-order(b));
  return `<div class="set-head"><div class="section-title">方案及價格</div>
      <button class="set-addbtn" onclick="openPlan(null)">＋ 新增課程方案</button></div>
    ${rows.length?`<table class="dtable set-tbl"><thead><tr>
      <th>樂器</th><th>類型</th><th>繳別</th><th class="c">堂數</th><th class="c">價格</th><th></th>
    </tr></thead><tbody>${rows.map(p=>`<tr>
      <td class="sname">${p.instrument}</td><td>${p.class_type}</td><td>${p.billing}</td>
      <td class="c">${p.sessions}</td><td class="c price">$${(p.price||0).toLocaleString()}</td>
      <td class="c"><button class="rowbtn" onclick="openPlan('${p.id}')">編輯</button></td>
    </tr>`).join('')}</tbody></table>`:`<div class="empty sm">尚未建立方案</div>`}`;
}
function deskSettingTeachers(){
  const list=DB.teachers.slice().sort((a,b)=>(b.active?1:0)-(a.active?1:0)||(a.sort||0)-(b.sort||0));
  return `<div class="set-head"><div class="section-title">任課老師（在職 ${activeTeachers().length}）</div>
      <button class="set-addbtn" onclick="openTeacher(null)">＋ 新增老師</button></div>
    <table class="dtable set-tbl"><thead><tr>
      <th>姓名</th><th>角色</th><th>教授樂器</th><th class="c">在學學生</th><th class="c">狀態</th><th></th>
    </tr></thead><tbody>${list.map(t=>`<tr class="${t.active?'':'inactive'}">
      <td class="sname">${t.name}</td><td>${t.role||'老師'}</td><td>${t.inst.join('、')}</td>
      <td class="c">${DB.students.filter(s=>s.t===t.id&&isActive(s)).length}</td>
      <td class="c">${t.active?'在職':'<span class="badge">已停用</span>'}</td>
      <td class="c"><button class="rowbtn" onclick="openTeacher('${t.id}')">編輯</button>
        <button class="rowbtn ${t.active?'off':''}" onclick="event.stopPropagation();toggleTeacher('${t.id}')">${t.active?'停用':'啟用'}</button></td>
    </tr>`).join('')}</tbody></table>`;
}
function deskSettingAllowed(){
  const rows = ALLOWED.length ? ALLOWED : [{ email: MY_EMAIL||'—', note:'目前登入中' }];
  return `<div class="set-head"><div class="section-title">管理者白名單${ALLOWED.length?'（'+ALLOWED.length+'）':''}</div>
      <button class="set-addbtn" onclick="addAllowed()">＋ 新增 Email</button></div>
    <table class="dtable set-tbl"><thead><tr><th>Email</th><th>備註</th><th></th></tr></thead><tbody>
    ${rows.map(a=>{
      const me=(a.email||'').toLowerCase()===(MY_EMAIL||'').toLowerCase();
      return `<tr><td class="sname">${a.email}</td><td>${me?'目前登入中':(a.note||'—')}</td>
        <td class="c">${me?'<span class="badge pipa">本人</span>'
          :`<button class="rowbtn off" onclick="removeAllowedEmail('${a.email}')">移除</button>`}</td></tr>`;
    }).join('')}</tbody></table>
    ${ALLOWED.length?'':'<div class="meta set-note">＊白名單尚未啟用（請先在 Supabase 執行 C1 SQL）。</div>'}`;
}
function deskSettingView(){
  return `<div class="setpane">${deskSettingPlans()}${deskSettingTeachers()}${deskSettingAllowed()}
    <a class="resetlink" onclick="logout()">登出</a>
    <div class="empty sm">雲端版 · Supabase</div></div>`;
}

/* ── 報表：桌機攤成多欄儀表板 ─────────────────────────────
   reportView() 產生的是「區段標題、表格、區段標題、表格…」一路平鋪，
   沒有可以當格子的容器，所以重繪後依標題把每一段包成一個 <section>。
   手機不跑這段，DOM 完全不變。 */
function groupReportSections(main){
  if(!main) return;
  let cur=null;
  Array.prototype.slice.call(main.children).forEach(el=>{
    if(el.classList.contains('section-title')){
      cur=document.createElement('section');
      cur.className='dk-sec';
      main.insertBefore(cur, el);
    }
    if(cur) cur.appendChild(el);
  });
}

/* ── 跨斷點：版面差太多，不能只靠 CSS，要整個重繪 ───────────── */
matchMedia('(min-width: 1024px)').addEventListener('change', ()=>{ rehomeModals(); render(); });
