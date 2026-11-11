/* modal-plan.js — 方案管理 modal（新增／編輯／刪除價目） */
function openPlan(id){
  document.body.classList.add('modal-open');
  const p = id ? PLANS.find(x=>x.id===id) : null;
  ui.pmodal = p ? { id:p.id, instrument:p.instrument, class_type:p.class_type, billing:p.billing, sessions:p.sessions, price:p.price, isNew:false }
                : { id:null, instrument:'古箏', class_type:'個人', billing:'季繳', sessions:12, price:0, isNew:true };
  renderPlanModal();
}
function renderPlanModal(){
  const m=ui.pmodal; if(!m) return;
  const esc=(v)=>String(v==null?'':v).replace(/"/g,'&quot;');
  const host=modalHost('pov');   // 桌機掛進右欄，手機維持 document.body
  const billChips=['月繳','季繳','單堂'].map(o=>`<div class="chipbtn ${m.billing===o?'sel':''}" onclick="pfield('billing','${o}')">${o}</div>`).join('');
  host.innerHTML=`<div class="overlay" onclick="if(event.target===this)closePlan()">
    <div class="sheet">
      <div class="handle"></div>
      <h3><span class="sheet-ttl"><span class="t">${m.isNew?'新增方案':'編輯方案'}</span></span>
        <span class="sheet-acts"><button class="sheet-x" onclick="closePlan()" title="關閉" aria-label="關閉">✕</button></span></h3>
      <div class="field f-inst"><label>學習樂器</label>
        <input class="inp" value="${esc(m.instrument)}" oninput="ui.pmodal.instrument=this.value">
        <div class="fieldhint">可自由打字，例如 古箏、琵琶、二胡…</div></div>
      <div class="field f-type"><label>授課類型</label>
        <input class="inp" value="${esc(m.class_type)}" oninput="ui.pmodal.class_type=this.value">
        <div class="fieldhint">可自由打字，例如 個人、團體、雙人…</div></div>
      <div class="field f-plan"><label>方案</label><div class="chips">${billChips}</div></div>
      <div class="field f-att"><label>堂數</label><input class="inp" type="number" inputmode="numeric" value="${m.sessions}" oninput="ui.pmodal.sessions=parseInt(this.value||'0',10)"></div>
      <div class="field f-amt"><label>價格</label><input class="inp" type="number" inputmode="numeric" value="${m.price}" oninput="ui.pmodal.price=parseInt(this.value||'0',10)">
        <div class="fieldhint">新生建檔時自動套用</div></div>
      <div class="actions">
        <button class="btn ghost" onclick="closePlan()">取消</button>
        <button class="btn primary" onclick="savePlan()">${m.isNew?'新增':'儲存'}</button>
      </div>
      ${!m.isNew?`<a class="resetlink danger" onclick="deletePlan()">🗑 刪除此方案</a>`:''}
    </div></div>`;
}
function pfield(k,v){ ui.pmodal[k]=v; if(k==='billing' && ui.pmodal.isNew){ ui.pmodal.sessions = v==='季繳'?12:(v==='單堂'?1:4); } renderPlanModal(); }
function closePlan(){ const h=document.getElementById('pov'); if(h) h.remove(); ui.pmodal=null; document.body.classList.remove('modal-open'); }
async function savePlan(){
  const m=ui.pmodal;
  if(!m.instrument.trim()||!m.class_type.trim()){ toast('請填樂器與班型'); return; }
  const rec={ instrument:m.instrument.trim(), class_type:m.class_type.trim(), billing:m.billing, sessions:m.sessions||(m.billing==='季繳'?12:(m.billing==='單堂'?1:4)), price:m.price||0 };
  if(m.isNew){
    const { data, error } = await sb.from('plans').insert(rec).select().single();
    if(error){ toast(/duplicate|unique/i.test(error.message)?'已有相同的 樂器×班型×繳別':'新增失敗：'+error.message); return; }
    PLANS.push(data);
  } else {
    const { error } = await sb.from('plans').update(rec).eq('id',m.id);
    if(error){ toast('儲存失敗：'+error.message); return; }
    Object.assign(PLANS.find(x=>x.id===m.id), rec);
  }
  // 同步 PLAN_PRICE（古箏個人）
  const g=(b)=>{ const p=PLANS.find(x=>x.instrument==='古箏'&&x.class_type==='個人'&&x.billing===b); return p?p.price:null; };
  PLAN_PRICE['季繳']=g('季繳')||PLAN_PRICE['季繳']; PLAN_PRICE['月繳']=g('月繳')||PLAN_PRICE['月繳'];
  const created=m.isNew; closePlan(); render(); toast(created?'已新增方案':'已更新方案');
}
async function deletePlan(){
  const m=ui.pmodal; if(!m||m.isNew) return;
  if(!confirm(`確定刪除「${m.instrument} ${m.class_type} ${m.billing}」這個方案價？\n（已建立的學生不受影響）`)) return;
  const { error } = await sb.from('plans').delete().eq('id',m.id);
  if(error){ toast('刪除失敗：'+error.message); return; }
  PLANS = PLANS.filter(x=>x.id!==m.id);
  closePlan(); render(); toast('已刪除方案');
}
