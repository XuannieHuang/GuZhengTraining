/* view-login.js — 登入頁 */
function loginView(){
  return `<div class="login">
    <div class="login-card">
      <div class="logo"><img src="logo.png" alt="箏心古箏 logo"></div>
      <h2>教室管理</h2>
      <button class="btn google block" onclick="googleLogin()">
        <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>使用 Google 登入</button>
      <div class="login-or"><span>或以帳號密碼登入</span></div>
      <input class="inp" id="acc" type="email" placeholder="Email" autocomplete="username">
      <input class="inp" id="pwd" type="password" placeholder="密碼" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')doLogin()">
      <button class="btn primary block" id="loginbtn" onclick="doLogin()">登入</button>
      ${ui.loginMsg?`<div class="login-msg ${ui.loginMsg.includes('中…')||ui.loginMsg.includes('前往')?'info':'err'}">${ui.loginMsg}</div>`:''}
    </div>
    <p class="login-foot">如欲加入請聯絡管理者</p>
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
