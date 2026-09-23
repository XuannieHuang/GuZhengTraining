# GuZhengTraining — 古箏/琵琶教室管理 App

音樂教室的**管理端**行動網頁 App：追蹤學生繳費、上課堂數與器材租借。

- **線上版**：https://stupendous-biscochitos-26954f.netlify.app
- **技術**：純前端（HTML/CSS/JS，無框架）＋ Supabase（Postgres/Auth/RLS）＋ Netlify（Git 自動部署）
- **登入**：Google 登入 + email 白名單（只有白名單內的管理者能使用）

## 目錄
- `prototype/` — App 本體（部署目錄；Netlify Publish directory）
- `supabase/` — 資料庫 SQL 與設定文件
- `操作手冊.md` — **實務操作指引**（每天怎麼用、各種情況怎麼處理、出問題怎麼辦）
- `功能說明.md` — 目前功能總覽（技術面）
- `tools/` — 對帳與維運工具（Python，本機執行）
- `line-bot/` — LINE 語音記帳小幫手（Apps Script，尚未部署）
- `未來計畫.md` — 待辦與未來規劃

> 註：含真實老師/學生姓名的種子資料與含機密的設定檔已排除版控（見 `.gitignore`），不在此公開 repo 內。
