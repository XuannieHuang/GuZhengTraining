/* view-login.js — 登入頁 */
function loginView(){
  return `<div class="login">
    <div class="login-card">
      <div class="logo">🎵</div>
      <h2>教室管理</h2>
      <p>管理端 · 繳費與上課追蹤</p>
      <button class="btn google block" onclick="googleLogin()">
        <span class="g-ic">G</span> 用 Google 登入</button>
      <div class="login-or"><span>或用帳號密碼</span></div>
      <input class="inp" id="acc" type="email" placeholder="Email" autocomplete="username">
      <input class="inp" id="pwd" type="password" placeholder="密碼" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')doLogin()">
      <button class="btn primary block" id="loginbtn" onclick="doLogin()">登入</button>
      ${ui.loginMsg?`<div class="login-msg ${ui.loginMsg.includes('中…')||ui.loginMsg.includes('前往')?'info':'err'}">${ui.loginMsg}</div>`:''}
    </div>
    <p class="login-foot">雲端共用 · 不開放自由註冊<br>需由管理者加入白名單才能使用</p>
  </div>`;
}
// 不在白名單時顯示
function deniedView(){
  return `<div class="login">
    <div class="login-card">
      <div class="logo">🔒</div>
      <h2>尚未開通</h2>
      <p>你的帳號<br><b>${MY_EMAIL||'—'}</b><br>尚未加入白名單，請聯絡管理員開通後再使用。</p>
      <button class="btn ghost block" onclick="logout()">登出 / 換帳號</button>
    </div>
  </div>`;
}
function bindLogin(){ const a=document.getElementById('acc'); if(a&&!ui.loginMsg) a.focus(); }
async function doLogin(){
  const email=(document.getElementById('acc').value||'').trim();
  const pwd=document.getElementById('pwd').value||'';
  if(!email||!pwd){ ui.loginMsg='請輸入 Email 與密碼'; render(); return; }
  ui.loginMsg='登入中…'; render();
  const { error } = await sb.auth.signInWithPassword({ email, password:pwd });
  if(error){ ui.loginMsg='登入失敗：'+error.message; render(); return; }
  MY_EMAIL=email; ME=email.split('@')[0];
  // 白名單把關
  const gate = await loadAllowed();
  if(gate==='denied'){ ui.loginMsg=''; ui.screen='denied'; render(); return; }
  ui.loginMsg='';
  try{ await loadAll(); }catch(e){ ui.loginMsg='讀取資料失敗：'+e.message; render(); return; }
  ui.screen='todo'; render();
}
// Google 登入：導向 Google → 回來後由 boot() 接手把關
async function googleLogin(){
  ui.loginMsg='前往 Google…'; render();
  const redirectTo = location.href.split('#')[0].split('?')[0];
  const { error } = await sb.auth.signInWithOAuth({ provider:'google', options:{ redirectTo } });
  if(error){ ui.loginMsg='Google 登入失敗：'+error.message; render(); }
}
