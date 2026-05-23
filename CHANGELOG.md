# Changelog

## v1.0.9 (2026-05-23)

### 聊天系統全面重構
- 移除 Redis KV 依賴，改為 PostgreSQL + SSE 即時推送
- 所有聊天訊息（使用者、中獎、寶箱、禮物）統一存入 `chat_messages` 表
- 前端改用 EventSource 接收即時訊息，不再 3 秒輪詢
- 移除 10 秒 GET 快取（解決 cache 回存空資料問題）
- 新增 `/api/v1/support/chat/stream` SSE 端點

### Coinflip 全面修復
- 改為回合制（下注後即時顯示結果，不再等待 6 秒倒數）
- 修復 Response 雙層包裹導致 `winner/selection` 為 undefined
- 前端直接用 `winner === selection` 判斷輸贏，不依賴 `settlement.isWin`
- 防損失 Buff 退款不再誤發中獎廣播（`payout > betAmount` 才廣播）
- 移除自動分局設定，聊天區中獎廣播恢復正常

### 市場終端重新設計
- 大盤指數圖表（gradient fill SVG）
- 個股折線圖（浮動可拖曳圖卡）
- 銀行分頁新增貸款功能（借貸 / 還款）
- 合約止盈止損價正確傳遞與持久化
- 持倉顯示每筆保證金金額
- 股票網格與圖表左右並排
- 側欄可收起，響應式佈局（電腦/手機）

### 老虎機
- 新增連續旋轉功能（自動 x5 / x10 / x25 / 50）
- 可隨時中斷，結束顯示統計摘要

### 錢包與交易紀錄
- 遊戲結果寫入 `wallet_ledger_entries`（下注 + 派彩）
- `market_futures_open` / `market_futures_close` 中文化
- 交易紀錄顏色改依金額正負判定
- 空投改為即時入帳（非同步結算），不再等待鏈上確認
- 每日簽到連續天數 + 獎勵倍率 + 30 日曆
- 服務器 24h 狀態圖表

### 任務系統（每日任務）
- 任務池擴充至 40 種，每天隨機抽 4 個
- 每日任務置頂、領取後隱藏
- VIP 限定任務
- 目標值合理化 + 追蹤 play 次數

### 公告與活動
- 重大警報僅顯示 `urgent` 類型
- 公告類型 i18n（`type_info`）
- 公告動態頁合併交易紀錄分頁
- 支援中心移除聊天 widget，工單表單上移

### 其他修復
- 伺服器運行時間 `< 1m` 取代 `0m`
- 收藏櫃合併至背包（`/app/collection` → `/app/inventory`）
- 每日任務改午夜重置（非 24h）
- 登入流程修正（`useFastLogin` 缺少 `return`）
- 伺服器 uptime 顯示修正
- AGENTS.md 建立
