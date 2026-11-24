/* data.js — 狀態、欄位對應、共用邏輯、雲端載入/寫回、toast */

/* ---------- 狀態 ---------- */
let DB = { teachers:[], students:[], rentals:[], books:[] };
let PLANS = [];
let PLAN_PRICE = {'季繳':10000,'月繳':3500};
let ME = '';
let MY_EMAIL = '';
let ALLOWED = [];   // 白名單 [{email,note}]
let REPORTS = { payments:null, month:'' };   // lastCount 是「最後一次盤點日」，進報表時才載
let ui = { screen:'login', tab:null, search:'', modal:null, loginMsg:'', rentTab:'active', showInact:false, evFilter:'all', evSearch:'' };

/* ---------- Supabase 欄位 <-> 畫面欄位 對應 ---------- */
function mapTeacher(r){ return { id:r.id, name:r.name, role:r.role, inst:r.instruments||[], sort:r.sort, active:r.active!==false }; }
function activeTeachers(){ return DB.teachers.filter(t=>t.active!==false); }
function mapStudent(r){ return { id:r.id, t:r.teacher_id, name:r.name, inst:r.instrument, type:r.class_type,
  plan:r.plan, attended:r.attended||0, pay:r.last_pay_date, amt:r.last_pay_amount, status:r.status,
  contact:r.contact||'', partner:r.partner_id||null, note:r.note||'', checked:!!r.checked, notified:!!r.notified,
  deleted:!!r.deleted_at, stopped:r.stopped_at||null }; }
function studentName(id){ const s=DB.students.find(x=>x.id===id); return s?s.name:''; }
function mapBook(r){ return { id:r.id, name:r.name, price:r.price, qty:r.qty||0,
  loc:r.location||'', photo:r.photo_path||'', note:r.note||'',
  active:r.active!==false, deleted:!!r.deleted_at }; }
function mapRental(r){ return { id:r.id, sid:r.student_id, name:r.renter_name, inst:r.instrument, billing:r.billing,
  pay:r.pay_date, start:r.start_date, due:r.due_date, status:r.status, returned:r.returned_date||null, note:r.note||'' }; }

/* ---------- 共用邏輯 / 日期 ---------- */
function isActive(s){ return s.status==='在學' || s.status==='新生'; }
function isDue(s){
  if(!isActive(s)) return false;
  if(s.plan==='單堂') return s.attended>=1;                 // 單堂：上完(剩0)就提醒
  return s.plan==='季繳' ? s.attended>10 : s.attended>=3;   // 季繳已上>10（11起）/ 月繳已上≥3
}
function teacherName(id){ const t=DB.teachers.find(t=>t.id===id); return t?t.name:''; }
function planPrice(inst, type, billing){
  const p=PLANS.find(x=>x.instrument===inst && x.class_type===type && x.billing===billing);
  return p ? p.price : (billing==='季繳'?10000:3500);
}
function rentalTeacher(r){
  let s = r.sid ? DB.students.find(x=>x.id===r.sid) : null;
  if(!s) s = DB.students.find(x=>x.name===r.name);
  return s ? teacherName(s.t) : '';
}
function planClass(p){ return p==='季繳'?'j':'m'; }

/* 記繳費要扣的是「剛用完的那一期」，不是新買的那一期。

   已上堂數的意義是「這一期已經上了幾堂」，剩餘堂數＝方案堂數 − 已上堂數。
   所以繳費開新一期時，要把上一期的額度結清、把超出的部分帶到新一期：

       已上堂數 -= planSessions(舊方案) + planSessions(新方案) × (期數 − 1)

   第一期用來結清上一期，多買的期數才是純粹的存堂。
   方案沒變時這個結果跟「planSessions(新方案) × 期數」完全一樣，
   只有換方案（月↔季↔單堂）才會不同 —— 原本會把月繳用完的 4 堂
   當成季繳的 4 堂去扣 12，變成 −8（等於憑空多出 8 堂）。 */
function payDeduct(oldPlan, newPlan, periods){
  return planSessions(oldPlan) + planSessions(newPlan) * ((periods || 1) - 1);
}

/* 上一期是用哪個方案買的 —— 以最後一筆「正數」繳費為準（退費不算）。
   Excel 匯入、沒有逐筆繳費紀錄的舊資料，退回用學生目前的方案。 */
async function lastPaidPlan(studentId, fallback){
  try{
    const { data, error } = await sb.from('payments')
      .select('billing,pay_date').eq('student_id', studentId)
      .gt('amount', 0).order('pay_date', { ascending:false }).limit(1);
    if(error || !data || !data.length) return fallback;
    return data[0].billing || fallback;
  }catch(e){ return fallback; }
}
function today(){ const d=new Date(); return d.toISOString().slice(0,10); }
function fmtDate(d){ if(!d) return '—'; const x=new Date(d); return (x.getMonth()+1)+'/'+x.getDate(); }
function fmtDate2(d){ if(!d) return '—'; const x=new Date(d); return x.getFullYear()+'/'+(x.getMonth()+1)+'/'+x.getDate(); }
function addMonths(dateStr,n){ const d=new Date(dateStr); d.setMonth(d.getMonth()+n); return d.toISOString().slice(0,10); }
function dueFromStart(start,billing){ return start ? addMonths(start, billing==='季繳'?3:1) : null; }
function rentalState(r){
  if(r.status==='已還箏') return 'returned';
  if(!r.due) return 'active';
  const t=today();
  if(r.due < t) return 'overdue';
  const d=new Date(r.due), n=new Date(t);
  if(d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth()) return 'soon';
  return 'active';
}

/* ---------- 從雲端載入 ---------- */
async function loadAll(){
  const [tRes, sRes, pRes, rRes, bRes] = await Promise.all([
    sb.from('teachers').select('*').order('sort'),
    sb.from('students').select('*').order('name'),
    sb.from('plans').select('*'),
    sb.from('rentals').select('*'),
    sb.from('books').select('*').order('name')
  ]);
  if(tRes.error) throw tRes.error;
  DB.teachers = (tRes.data||[]).map(mapTeacher);
  DB.students = (sRes.data||[]).map(mapStudent).filter(s=>!s.deleted);   // 註記刪除的不載入
  DB.rentals  = (rRes.data||[]).map(mapRental);
  // 課本表是後來才加的，舊環境讀不到就當作沒有，不要讓整個 App 起不來
  DB.books    = bRes.error ? [] : (bRes.data||[]).map(mapBook).filter(b=>!b.deleted);
  PLANS = pRes.data||[];
  const g=(b)=>{ const p=PLANS.find(p=>p.instrument==='古箏'&&p.class_type==='個人'&&p.billing===b); return p?p.price:null; };
  PLAN_PRICE['季繳']=g('季繳')||10000; PLAN_PRICE['月繳']=g('月繳')||3500;
  if(!ui.tab && DB.teachers[0]) ui.tab=DB.teachers[0].id;
}

/* ---------- 白名單把關（authorization） ---------- */
// 回傳 'ok'（在白名單）/ 'denied'（不在）/ 'nogate'（白名單表還沒建，過渡期放行）
async function loadAllowed(){
  const { data, error } = await sb.from('allowed_emails').select('email,note').order('email');
  if(error){ ALLOWED=[]; return 'nogate'; }   // 表不存在或讀取失敗 → 不鎖住，照舊放行
  ALLOWED = data||[];
  return ALLOWED.length>0 ? 'ok' : 'denied';   // RLS 會讓非白名單者讀到 0 筆
}
async function addAllowedEmail(email){
  email=(email||'').trim().toLowerCase();
  if(!email) return;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ toast('Email 格式不正確'); return; }
  if(ALLOWED.some(a=>a.email.toLowerCase()===email)){ toast('此 email 已在白名單'); return; }
  const { error } = await sb.from('allowed_emails').insert({ email });
  if(error){ toast('新增失敗：'+error.message); return; }
  ALLOWED.push({ email, note:'' }); ALLOWED.sort((a,b)=>a.email.localeCompare(b.email));
  render(); toast('已加入白名單');
}
async function removeAllowedEmail(email){
  if(email.toLowerCase()===MY_EMAIL.toLowerCase()){ toast('不能移除自己'); return; }
  if(!confirm(`確定移除 ${email}？\n移除後此帳號將無法再使用 App。`)) return;
  const { error } = await sb.from('allowed_emails').delete().eq('email',email);
  if(error){ toast('移除失敗：'+error.message); return; }
  ALLOWED = ALLOWED.filter(a=>a.email!==email);
  render(); toast('已移除');
}

/* ---------- 報表：載入繳費紀錄 ---------- */
async function loadReportData(){
  const { data, error } = await sb.from('payments').select('*');
  if(error){ toast('讀取繳費紀錄失敗：'+error.message); REPORTS.payments=[]; render(); return; }
  REPORTS.payments = data||[];
  render();
}

/* ---------- 寫回雲端 ---------- */
function pushStudent(id, patch){
  sb.from('students').update(patch).eq('id',id).then(({error})=>{ if(error) toast('儲存失敗：'+error.message); });
}
/* ---------- 老師異動歷史：學生換老師時記一筆 ---------- */
function logTeacherChange(studentId, fromId, toId){
  sb.from('teacher_changes').insert({ student_id:studentId, from_teacher_id:fromId||null, to_teacher_id:toId||null })
    .then(({error})=>{ if(error) toast('異動紀錄失敗：'+error.message); });
}

/* ---------- 雙人組配對：維持雙向一致（A↔B），各自繳費不互相影響 ---------- */
async function applyPartnerLink(studentId, newPartner, prevPartner){
  const writes=[];  // [id, partner_id]
  if(prevPartner===newPartner && (!newPartner || DB.students.find(x=>x.id===newPartner)?.partner===studentId)) return;
  // 解除舊配對的另一端
  if(prevPartner && prevPartner!==newPartner){
    const old=DB.students.find(x=>x.id===prevPartner);
    if(old && old.partner===studentId){ old.partner=null; writes.push([prevPartner,null]); }
  }
  if(newPartner){
    const np=DB.students.find(x=>x.id===newPartner);
    if(np){
      if(np.partner && np.partner!==studentId){  // 新同學原本配別人 → 拆掉那一端
        const npOld=DB.students.find(x=>x.id===np.partner);
        if(npOld){ npOld.partner=null; writes.push([npOld.id,null]); }
      }
      np.partner=studentId; writes.push([newPartner,studentId]);
    }
  }
  for(const [id,p] of writes){
    const { error } = await sb.from('students').update({partner_id:p}).eq('id',id);
    if(error) toast('配對同步失敗：'+error.message);
  }
}
async function logout(){ await sb.auth.signOut(); DB={teachers:[],students:[],rentals:[]}; ALLOWED=[]; ME=''; MY_EMAIL=''; ui={screen:'login',tab:null,search:'',modal:null,loginMsg:'',rentTab:'active',showInact:false,evFilter:'all',evSearch:''}; render(); }

/* ---------- toast ---------- */
let toastT;
function toast(msg){ const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1800); }

/* 報表那張課本卡要用的「最後盤點日」。沒盤過就是 null，讀失敗也當作沒盤過。 */
async function loadLastCount(){
  const { data, error } = await sb.from('book_moves')
    .select('move_date').eq('kind','盤點').order('move_date',{ascending:false}).limit(1);
  REPORTS.lastCount = (error || !data || !data.length) ? null : data[0].move_date;
  render();
}
