# 教室管理 App — 搬到朋友的 PHP + MySQL 主機（遷移計畫）

> 狀態：**計畫草案，待你確認**。確認後再實作。

## 動機
- Supabase 免費方案**閒置約 7 天會自動暫停**，要手動喚醒，很麻煩。
- 想改放到朋友的主機（PHP + MySQL），不會自動暫停、也更能自己掌控。

## 🔑 關鍵認知（好消息，先講清楚）
- 目前的前端是**純 vanilla JS（HTML/CSS/JS，沒有用 React 或任何框架）**。
- 所以**整套畫面 UI 幾乎可以原封不動保留**，不需要「把網頁改寫成 PHP 樣板」。
- 真正要換的只有「**後端資料層**」：現在 `data.js` 和各 modal 直接呼叫 Supabase（`sb.from(...)`）的地方，改成呼叫「**PHP API 端點**」；PHP 再去讀寫 MySQL。
- **結論**：不是整個重寫，而是「**前端保留 ＋ 新增一層 PHP API ＋ 換成 MySQL**」。工作量與風險都小很多。

## 目標架構
```
瀏覽器（現有 vanilla JS 前端，UI 不變）
        │  fetch（傳 JSON）
        ▼
PHP API（朋友主機，如 /api/*.php） ←──→ MySQL（朋友主機）
```
（前端靜態檔 + PHP API 放同一台主機即可。）

## 要改哪些東西
1. **資料庫**：Supabase Postgres → MySQL。把現有表轉成 MySQL 版：
   `teachers / students / payments / rentals / rental_logs / teacher_changes / allowed_emails`（或改用帳號表）。
2. **後端 API（新寫）**：一組 PHP 檔提供 CRUD（回 JSON），每支都做**登入驗證**。例如：
   `api/login.php, api/logout.php, api/students.php, api/teachers.php, api/payments.php, api/rentals.php, api/rental_logs.php, api/plans.php`。
3. **前端資料層（小改）**：改寫 `data.js` 的 `loadAll / pushStudent / loadReportData …`，以及各 modal 內 `sb.from(...)` 的呼叫 → 改成 `fetch('api/xxx.php')`。**其他 render/UI 邏輯不動。**
4. **登入 / 授權**：Supabase Auth（Google + 白名單 + RLS）→ PHP 版。
   - Postgres 的 RLS（自動列級權限）沒了 → 改成「**每支 PHP API 檢查登入 session（＋白名單）**」。
5. **部署**：Netlify → 朋友的 PHP 主機（前端檔與 PHP API 一起放）。GitHub 版控可續用，但自動部署方式要看主機支不支援。

## ❓需要你先確認的決策
- **A. 朋友主機規格**（很重要，決定可行性與細節）：
  - PHP 版本？（建議 8.0+）
  - MySQL / MariaDB？
  - 共享主機（cPanel 那種）還是 VPS？
  - 有沒有 HTTPS（https 網址）？
  - 用什麼上傳檔案？（FTP / cPanel 檔案管理 / Git？）
- **B. 登入方式**（影響工作量最大）：
  - ✅（推薦、最省事）**帳號 + 密碼登入**：3 位管理者各一組，用 PHP session。簡單穩定、幾天就能好。
  - 或 **保留 Google 登入**：要在 PHP 重刻 Google OAuth，較費工、較多眉角。
- **C. 前端保留 OK 嗎**：確認接受「**UI 全保留、只換後端**」（而非把頁面改成 PHP 樣板）。

## 實作步驟（等你確認 A/B/C 後）
1. MySQL 建表 SQL（schema 轉換）。
2. PHP：DB 連線設定 + 登入（`login.php` / session / 白名單或帳號表）。
3. PHP：各資料表 CRUD API（含權限檢查）。
4. 前端：把 `data.js` + 各 modal 的 Supabase 呼叫換成 `fetch` API。
5. 資料搬移：Supabase 現有資料匯出 → 匯入 MySQL。
6. 部署到朋友主機、逐頁測試，跑通後正式切換。

## ⚠️ 風險 / 注意
- **安全**：沒有 RLS 自動擋了，**每支 PHP API 都必須驗證登入**，否則資料會裸奔。這是最需要小心的點。
- **資料搬移**：現有 Supabase 資料要完整轉進 MySQL（含關聯 id）。
- **一次性切換**：schema／API／前端要一起完成才能上線；建議先在朋友主機建**測試版**跑通，再把網址切過去。
- **DB 連線密碼**等機密只放 PHP 端（不進前端、不進公開 repo）。

## 💡 附帶一提（你可考慮的更省事替代方案）
若「Supabase 自動暫停」是唯一痛點，其實也可以**不搬家**：用一個每週自動 ping 資料庫的排程（keep-alive）就能避免暫停，幾乎零改動。搬到 PHP+MySQL 的好處是「完全自己掌控、朋友主機不暫停」，但工作量與安全責任較大。兩條路都可，你決定。
