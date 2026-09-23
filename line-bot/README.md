# LINE 語音記帳小幫手 — 設定步驟

> 階段 2：主任在群組傳語音 → 機器人辨識 → 回覆解析結果（**尚未寫入帳本**，先驗證辨識準度）。
> 程式碼是**兩個檔案**：`Code.gs`（主程式）與 `PinyinMap.gs`（漢字拼音表，自動產生）。
> **所有金鑰都放 Apps Script 的「指令碼屬性」，不會進這個 repo。**

## 它怎麼認人

**不信任語音辨識出來的「字」，只用「音」去比對系統名單。**
主任講「依晨」、辨識成「依晨」，程式照樣對到系統裡的 `林依辰`——因為拼音一樣。
顯示與寫入的一律是**系統的正確全名**，所以人名永遠不會寫錯。

比對順序：姓名完全相同 → 全名同音 → 疊字暱稱（一律列候選）→ 只講名補姓氏。
對到多人就列出來讓主任點選（在學的排前面）；完全對不到就只記帳、不進系統。

---

## 你需要準備 4 把鑰匙

| 屬性名稱 | 哪裡拿 |
|---|---|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers → Messaging API |
| `GEMINI_API_KEY` | Google AI Studio |
| `SUPABASE_URL` | Supabase 專案設定 → API（就是 `https://toxfwcuhugrqwibghiig.supabase.co`） |
| `SUPABASE_SERVICE_KEY` | Supabase 專案設定 → API → **service_role**（⚠️ 這把很敏感，只放 Apps Script） |

---

## Step 1｜建立 LINE 機器人

1. 到 <https://developers.line.biz/console/> 用你的 LINE 登入
2. 建 **Provider**（名稱隨意，例如「箏心」）
3. 在該 Provider 建 **Messaging API channel**（這就是機器人）
4. 進 channel → **Messaging API** 分頁：
   - **Channel access token (long-lived)** → 按 Issue，複製起來
   - **Auto-reply messages（自動回應訊息）** → **關閉**
   - **Greeting messages** → 可關
   - **Allow bot to join group chats（允許加入群組）** → **開啟**

## Step 2｜拿 Gemini API 金鑰

1. 到 <https://aistudio.google.com/apikey>
2. 建立 API key，複製起來（免費額度對我們的用量綽綽有餘）

## Step 3｜拿 Supabase service key

1. Supabase → 你的專案 → **Project Settings → API**
2. 複製 **service_role** 那把（不是 anon）
3. ⚠️ 這把可以繞過權限，**只貼進 Apps Script，不要貼到任何網頁或 repo**

## Step 4｜建立 Apps Script 專案

1. 到 <https://script.google.com/> → **新增專案**
2. 把本資料夾的 `Code.gs` **整份內容**貼進去（取代原本的 `function myFunction()`）
3. 左側檔案列表按 **＋ → 指令碼**，命名 `PinyinMap`，把 `PinyinMap.gs` **整份內容**貼進去
   （66 KB，2 萬多個漢字的拼音表，貼一次就好）
4. 左側 **專案設定（齒輪）→ 指令碼屬性 → 新增指令碼屬性**，加入上表 4 個屬性
5. 回到編輯器，函式選 **`checkSetup`** → 按 **執行**
   - 第一次會要求授權，按「檢閱權限 → 進階 → 前往…（不安全）→ 允許」（這是你自己的專案，正常流程）
   - 執行紀錄應顯示：
     ```
     ✅ 屬性齊全；讀到學生 99 位（含停課）
     ✅ 拼音表覆蓋全部學生姓名
       測試「林依辰」→ 姓名相同：林依辰
       測試「依辰」→ 補姓氏：林依辰
       測試「靜靜」→ 暱稱：王晶婷、張靜茹、…
     ```
   - 若顯示 ❌ 或 0 位 → 金鑰或 URL 有誤，先修正再往下

## Step 5｜部署成 Webhook

1. 右上 **部署 → 新增部署作業**
2. 類型選 **網頁應用程式**
   - **執行身分**：我
   - **具有存取權的使用者**：**所有人**（LINE 才呼叫得到）
3. 部署後複製 **網頁應用程式網址**（`https://script.google.com/macros/s/.../exec`）

## Step 6｜把 Webhook 接到 LINE

1. 回 LINE Developers → 你的 channel → **Messaging API**
2. **Webhook URL** 貼上剛剛的網址 → **Update**
3. **Use webhook** → **開啟**
4. 按 **Verify**，出現 Success 就對了

## Step 7｜把機器人加進群組並測試

1. 在 LINE Developers 的 Messaging API 分頁掃 **QR code** 加機器人好友
2. 把機器人**邀請進你們 3 人群組**
3. 在群組**按住麥克風說一句**。這幾句用的是系統裡真實存在的人，可以驗證各種比對情境：

   | 說什麼 | 預期結果 |
   |---|---|
   | 「林依辰繳學費九千」 | ✅ 直接對到 林依辰 |
   | 「依辰繳學費九千」 | ✅ 補姓氏，一樣對到 林依辰 |
   | 「靜靜繳學費四千」 | ⚠️ 疊字暱稱 → 列出候選讓你看 |
   | 「依辰繳學費九千，靜靜繳學費四千」 | 一次兩筆，分別處理 |
   | 「買午餐一百二十元」 | 歸「支出」，不需對到學生 |

4. 機器人應回覆逐字稿與解析結果。**重點看人名有沒有對到正確的人、金額對不對。**

---

## 之後的階段（等辨識準度 OK 再做）

- **階段 3**：加確認按鈕、寫入 Google 試算表帳本
  欄位結構已確定：`日期｜分類科目｜名稱/摘要｜收/支款人｜收支出｜備註`
  摘要一律用**系統正確全名**寫（這樣以後對帳幾乎全自動）；備註加 `來源=LINE｜訊息ID=xxx`
  多一欄 `系統同步`＝`已同步`／`未對到`，讓你事後決定誰要建檔
- **階段 4**：同步 App（Supabase）繳費狀態；堂數計算與 App 的 `confirmPay()` 完全一致，不加特例
  停課者繳費＝復課 → 同時把狀態改回「在學」
- **階段 5**：防重複（同 student_id ＋ 同金額 ＋ 繳費日相差 ≤20 天 → 警告但不阻擋）

> 還缺你提供：**租箏款要不要自動續租一期**、**主任慣用講法 3–5 句**（用來調提示詞）。

## 疑難排解

| 狀況 | 可能原因 |
|---|---|
| 機器人沒反應 | Auto-reply 沒關、Use webhook 沒開、部署存取權不是「所有人」 |
| 回「`toPinyin is not defined`」 | `PinyinMap.gs` 沒貼進去，或檔名打錯 |
| 回「音檔下載失敗」 | Channel access token 過期或貼錯 |
| 回「辨識服務錯誤」 | Gemini 金鑰錯誤，或模型名稱要更新（改 `Code.gs` 的 `GEMINI_MODEL`） |
| `checkSetup` 讀到 0 位學生 | Supabase URL／service key 錯誤 |
| 同一則語音回覆兩次 | 正常防呆已內建（10 分鐘內同 messageId 只處理一次） |

## 修改程式後要記得

Apps Script 改完要 **重新部署**（部署 → 管理部署作業 → 編輯 → 版本選「新版本」→ 部署），Webhook 網址不變。

## 拼音表要不要重產？

**不用。** `PinyinMap.gs` 涵蓋 CJK 基本區全部 20,924 個漢字，新增學生用到什麼字都查得到。
只有將來 pypinyin 更新、或要改讀音時才需要重跑：

```bash
py tools/gen_pinyin_map.py
```
