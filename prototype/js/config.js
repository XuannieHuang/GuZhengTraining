/* config.js — Supabase 連線設定 */
const SB_URL='https://toxfwcuhugrqwibghiig.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRveGZ3Y3VodWdycXdpYmdoaWlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2ODExNjAsImV4cCI6MjA5NzI1NzE2MH0.hzfgb98Kzr1cMEStNdnLchcRlTh7BTvVacGZDTbrw00';
const sb = window.supabase.createClient(SB_URL, SB_KEY);
