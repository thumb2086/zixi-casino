# ZIXI CASINO — 開發計劃

## 分支策略

```
master: v1.0.5（穩定版，5 層寶箱原始結構）
dev:    逐步疊加小版本 → v1.1.0 最終合併至 master
```

## 版本路線圖

| 版本 | 範圍 | 內容 | 狀態 |
|------|------|------|------|
| **v1.0.6** | 寶箱 + XP | 8 層寶箱平衡、物品/當舖值調整、保底修正、經驗加成系統 | ✅ 開發完成 |
| **v1.0.7** | Coinflip | Route 統一使用 GameManager 賠率 | ✅ |
| **v1.0.8** | Slots（前端） | 補齊遺失常數 REEL_CELLS/SYMBOLS/reelDelay 等 | ✅ |
| **v1.0.9** | Roulette + 每日任務 | Roulette 數字賠 35x 應為 36x；新增每日任務系統，午夜刷新 | ✅ |
| **v1.0.10** | 賽馬系統 | RTP_SCALE=2.0 導致玩家優勢 → GameManager 統一邏輯、HE ~4%；統一開獎流程、多筆押注、勝率統計圖表、長期數據 localStorage、未下注也播動畫 | ✅ 開發完成 |
| **v1.0.11** | Bingo | RTP 修正：20 開獎號 + 新賠率表 + 逐顆開獎動畫 + hash 負數修復 | ✅ |
| **v1.0.12** | Dragon Tiger | FNV hash 負數修復、動態賠率 2~12x（route 改用 domain multiplier） | ✅ |
| **v1.0.13** | BluffDice | 固定預測 18 導致 -39% 玩家優勢 | 🏗️ |
| **v1.0.14** | Sicbo | 賠率調整、HE 檢查 | ⏳ |
| **v1.0.15** | Duel | 賠率 1.96x 與實際 HE 對齊檢查 | ⏳ |
| **v1.0.16** | Crash | 賠率/機率微調 | ⏳ |
| **v1.0.17** | Poker | 賠率/機率微調 | ⏳ |
| **v1.0.18** | Blackjack | 賠率/機率微調 | ⏳ |
| **v1.0.19** | VIP 遊戲 | Poker VIP / BluffDice VIP 房間入口、多人配對、牌型/骰子判定實作 | ⏳ |
| **v1.0.20** | 股市調整 + 交易效能 | 背景 tick、admin 端點、清算修正、前端極速反饋 | ⏳ |
| **v1.0.21** | 上鏈系統 | 上鏈排隊佇列、上鏈公開頁面 | ⏳ |
| **v1.0.22** | 交易紀錄 + 動態重構 | 交易紀錄系統完善、公開動態保留市場與錢包、移除重複錢包動態 | ⏳ |
| **v1.0.23** | 全站快取 + 監控 | 管理頁面載入優化、伺服器運行時間、重新登入時間反饋圖表 | ⏳ |
| **v1.0.24** | 公司系統 | `/upgrade-fab`、`/deposit`、招聘押金、export、測試 | ⏳ |
| **v1.0.25** | 排版檢查 + 色彩設計語言 | 全站頁面 UI 排列、文字溢出、RWD 斷點、元件間距一致性檢查與修正；導入新色彩系統（會員漸層、暗色主題色票、CSS 變數） | ⏳ |
| **v1.0.26** | 全站浮點修正 + 市場功能補強 | `round()` 預設 2dp、`formatNumber` 最大 2dp、全站 `.toFixed()` 統一為 2dp；市場新增 TP/SL 即時修改、一次還清貸款、全部賣出/全額買入、持倉點擊選股、浮動圖表放大拖曳、銀行利率顯示、slots auto-skip | ✅ |
| **v1.0.27** | 管理員工具全面升級 (zixi-dev-tool) | 後台管理 SPA（儀表板/維護/用戶/目錄/審核/活動/工單 7 標籤頁）+ 全站 i18n 重構（800+ locale key） | ✅ |
| **v1.1.0** | 正式版 | 全部合併至 master，穩定化 | 🎯 |

---

## 遊戲修正細節

### v1.0.7 — Coinflip
- Route 自行計算結果（`hashInt` + 2.0x）→ 改呼叫 `gameManager.resolveCoinflip()`，賠率 1.96x（2% HE）
- **檔案**: `apps/api/src/routes/v1/games/coinflip.ts`

### v1.0.8 — Slots（前端修復）
- 補上遺失的前端常數：`REEL_CELLS`、`randomSymbol`、`REEL_DELAY_MS`、`REEL_STOP_INTERVAL`
- **檔案**: `apps/web/src/features/casino/SlotsView.tsx`

### v1.0.9 — Roulette + 靶心任務
- **Roulette**: Domain `resolveRoulette` 中數字賠 35x → 36x
- **檔案**: `packages/domain/src/games/game-manager.ts`
- **靶心任務**: 新增每日/每週靶心任務系統，玩家達成指定目標（累計押注、勝場數、連勝等）可領取獎勵
- **檔案**: `packages/domain/src/missions/`、`apps/api/src/routes/v1/missions.ts`、`apps/web/src/features/missions/`

### v1.0.10 — Horse Racing
- **問題**: Route 自訂 HORSES 陣列 + RTP_SCALE=2.0 使 EV=1.055（玩家優勢）
- **修正**: Route 改用 GameManager 統一邏輯（FNV 哈希 + 權重），HE 調整至 ~4%
- **附加**: 統一開獎流程（下注→等封盤→開跑）、多筆押注/不同金額、勝率統計圖表（去重 roundId）、localStorage 長期數據、未下注也播動畫、UI 大改（🐎 emoji、配色、選擇器位置、方向修正）
- **檔案**: `apps/api/src/routes/v1/games/horse.ts`, `packages/domain/src/games/game-manager.ts`, `apps/web/src/features/casino/HorseRacingView.tsx`

### v1.0.11 — Bingo
- **問題**: 5/75 匹配率極低，RTP 僅 0.74%
- **修正**: 提高基礎命中率（擴大可選數字範圍或增加中獎組合），調整 payout 倍率
- **檔案**: `packages/domain/src/games/game-manager.ts`

### v1.0.12 — Dragon Tiger
- **問題**: ① `Math.random()` 不可驗證 ② flat 2x 賠率 ③ HE 40%
- **修正**: ① 改用 FNV 哈希 ② 採用 domain 的 `12/range` 變動賠率 ③ 重新計算平衡賠率
- **檔案**: `apps/api/src/routes/v1/games/shoot-dragon-gate*.ts`, `packages/domain/src/games/game-manager.ts`

### v1.0.13 — BluffDice
- **問題**: Route 硬編碼 `predictedTotal=18`（接近 5d6 期望值 17.5），導致 EV≈1.39
- **修正**: 讓玩家自選預測總和，調整賠率表使 HE 落在合理範圍
- **檔案**: `apps/api/src/routes/v1/games/bluffdice.ts`, `packages/domain/src/games/game-manager.ts`

### v1.0.14 — Sicbo
- 賠率調整、HE 檢查，確保與其他遊戲一致
- **檔案**: `packages/domain/src/games/game-manager.ts`

### v1.0.15 — Duel
- 賠率 1.96x 與實際 HE 的對齊檢查
- **檔案**: `packages/domain/src/games/game-manager.ts`

### v1.0.16 — Crash
- 賠率/機率微調，確保 HE 落在合理範圍
- **檔案**: `packages/domain/src/games/game-manager.ts`

### v1.0.17 — Poker
- 賠率/機率微調，確保 HE 落在合理範圍
- **檔案**: `packages/domain/src/games/game-manager.ts`

### v1.0.18 — Blackjack
- 賠率/機率微調，確保 HE 落在合理範圍
- **檔案**: `packages/domain/src/games/game-manager.ts`

---

## VIP 遊戲（v1.0.19）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| Poker VIP 房間入口 | **高** | Room `poker_vip` 已定義（vipLevel=1），需在 poker route 增加 VIP 房間分流、加入房間 API 串接、前端大廳顯示 VIP 房入口 |
| BluffDice VIP 房間入口 | **高** | Room `bluffdice_vip` 已定義（vipLevel=1），同上需 route + 前端整合 |
| 多人配對機制 | **高** | 等候佇列、湊滿人數自動開局、Bot 補位邏輯完善（`fillWithBots` 僅 70% 門檻，需確認穩定） |
| 牌型判定實作 | **高** | `MultiplayerGameManager.resolvePokerHand`（`room-manager.ts:134`）目前為 mock，需完成真實牌型比對（同花順、鐵支、葫蘆等） |
| 骰子比對實作 | **高** | `MultiplayerGameManager.resolveBluffDice`（`room-manager.ts:139`）目前為 mock，需完成真實吹牛骰判定 |
| 即時狀態同步 | **中** | 目前 `advancePoker` 純記憶體操作，需設計 SSE/WebSocket 推送玩家輪次、公共牌、獎池變化 |
| VIP 權限檢查 | **中** | `joinRoom` 已檢查 `vipLevel`，但前端需顯示鎖定狀態與升級引導 |
| 對局歷史查詢 | **低** | 記錄每局結果、底池、參與玩家，提供歷史查詢 |

---

## 股市調整 + 交易效能（v1.0.20）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| 背景市場 tick | **高** | 定時器統一推進價格，避免每 request 各自算 |
| Admin 干預端點 | **高** | 調整 symbol 價格/波動率、注入 shock、改利率 |
| futures_close tick | **中** | API 補上 tick 參數傳遞 |
| futures_open 遺漏 TP/SL 參數 | **高** | API `apps/api/src/routes/v1/market.ts:141,171` 未將 `takeProfitPrice`/`stopLossPrice` 從 request body 傳入 domain `openFutures()`，導致開倉永遠沒有停利停損價 |
| 持倉 TP/SL 即時調整 UI | **高** | 現有倉位無法事後修改停利停損點。需在持倉卡片內新增可直接編輯的 TP/SL 輸入框（類似開倉表單），並新增 API action 如 `futures_modify_tp_sl` 即時更新倉位的 `takeProfitPrice`/`stopLossPrice` |
| 清算檢查一致性 | **中** | PnL 99% 閾值與 liquidationPrice 公式對齊 |
| 前端極速反饋 | **高** | 股市/賭場操作先顯示結果再等後端/上鏈確認（optimistic UI） |
| 後端非阻塞 | **中** | 交易操作立即回傳，上鏈等慢操作背景排隊處理 |
| 股利/分割 | **低** | 長期功能 |

**交易效能優化原則**:
```
玩家操作 → 前端立即顯示結果（樂觀更新）
         → 後端快速驗證 + 記帳（ms 級）
         → 上鏈排隊慢慢跑（非阻塞）
```

---

## 上鏈系統（v1.0.21）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| 上鏈排隊佇列 | **高** | 目前有 TxIntent 但排隊狀態不透明。需佇列儀表板顯示 pending/broadcasted/confirmed/failed |
| 上鏈公開頁面 | **高** | 公開頁面查詢 tx hash、狀態、確認數、gas 用量。類似 etherscan 精簡版 |
| 佇列重試機制 | **中** | failed tx 自動重試，超過次數告警 |
| 佇列優先級 | **低** | 高價值交易優先處理 |

---

## 交易紀錄 + 動態重構（v1.0.22）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| 交易紀錄系統完善 | **高** | 完整查詢：時間範圍、類型篩選、分頁、匯出 |
| 公開交易動態 | **高** | 保留最新市場動態（大額交易/爆倉）與錢包動態（儲值/提領） |
| 移除錢包動態 | **高** | 錢包動態與交易紀錄功能重複，移除重複部分 |
| 動態 feed 效能 | **中** | 限制顯示筆數、只保留最近 N 筆 |

---

## 全站快取 + 監控（v1.0.23）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| 管理頁面載入優化 | **高** | 目前管理頁面載入慢，找出慢查詢 + 加入快取 |
| 全站快取策略 | **高** | API response cache（KV/Redis），靜態資源 CDN，資料庫查詢快取 |
| 伺服器運行時間 | **中** | server uptime 端點，前端顯示運行狀態 |
| 重新登入時間反饋 | **中** | 圖表記錄每次重新登入的響應時間，方便追蹤效能趨勢 |
| 快取失效機制 | **中** | 寫入操作時主動失效相關快取 |

---

## 公司系統（v1.0.24）

| 項目 | 優先級 | 說明 |
|------|--------|------|
| `/upgrade-fab` 路由 | **高** | Chip 公司無法升級 Fab Level，被鎖在 Memory Chip 產品外 |
| 招聘押金實作 | **高** | UI 說要 10× deposit 但 API 沒扣任何費用 |
| `/deposit` 路由 | **高** | 公司可提款到錢包，但無法從錢包存入資金 |
| Domain barrel export | **高** | company-manager 加入 `packages/domain/src/index.ts` |
| 單元測試 | **中** | 團隊加成/營收/研究等核心邏輯 |
| Fab 升級前端按鈕 | **中** | 目前僅文字標籤，無互動 |
| 公司事件歷史顯示 | **低** | `data.history` 有累積但前端沒展示 |
| 破產機制 | **低** | 現金可無限負值 |

---

## 顏色設計語言（v1.0.25）

### 當前問題
目前全站僅使用黃色（`#ffd700`）與黑色，缺乏層次感與會員辨識度。

### 新色彩系統

#### 會員等級身份色
| 等級 | 漸層 | 用途 |
|------|------|------|
| **鑽石** | `linear-gradient(90deg, #ff4fff, #fcc025)` 粉金漸層 | 鑽石會員徽章、專屬房間邊框、頭像光暈 |
| **黃金** | `linear-gradient(90deg, #ffd700, #fcc025)` 金金漸層 | 黃金會員徽章、VIP 入口按鈕、等級標籤 |
| **青銅** | `linear-gradient(90deg, #cd7f32, #fcc025)` 古銅金漸層 | 一般會員徽章、預設等級標示 |

#### UI 元件配色原則
| 元件 | 顏色 | 說明 |
|------|------|------|
| 背景底色 | `#0a0a0f`（深黑帶紫） | 取代純黑，增加質感 |
| 卡片/面板 | `#14141f` | 略亮於背景，區分層級 |
| 主要文字 | `#f0f0f0` | 高對比閱讀 |
| 次要文字 | `#888899` | 輔助資訊、提示 |
| 重點高亮 | `#ffd700` | 按鈕、連結、活躍狀態 |
| 成功/獲利 | `#00e676` | 遊戲勝利、正 PnL |
| 失敗/虧損 | `#ff5252` | 遊戲失敗、負 PnL |
| 警示/中立 | `#ffab40` | 等待中、部分完成 |
| 資訊/連結 | `#40c4ff` | 可點擊文字、說明圖示 |
| 邊框/分隔 | `#2a2a3a` | 卡片邊框、分隔線 |

#### 實作優先級
| 項目 | 優先級 | 說明 |
|------|--------|------|
| 會員等級漸層標籤 | **高** | 大廳、個人檔案、排行榜會員名稱使用對應漸層 |
| CSS 變數統一 | **高** | 抽取為 `--color-*` CSS custom properties，集中管理 |
| 按鈕、輸入框配色 | **高** | 按鈕使用金色主色，禁用態 / hover 態定義明確 |
| 卡片陰影與邊框 | **中** | 使用 `#2a2a3a` 邊框 + `rgba(255, 215, 0, 0.05)` 微光暈 |
| 暗色主題一致性 | **中** | 確保所有頁面背景/卡片統一使用新色票 |
| 成功/失敗色導入 | **中** | 遊戲結果、交易盈虧、通知使用綠/紅區分 |
| Tailwind 主題擴充 | **中** | 若使用 Tailwind，擴充 `theme.extend.colors` 涵蓋新色票 |

---

## v1.0.27 — 管理員工具全面升級 (zixi-dev-tool)

### 新增功能

#### 後台管理 SPA (`/admin`，7 標籤頁)
- **儀表板** — 用戶數、商店物品數、24h 交易數、組合包數即時面板 + 操作事件記錄
- **維護** — 公告 CRUD（新增/編輯/刪除/置頂/啟用停用）
- **用戶** — 地址搜尋、餘額查詢、Win Bias 設定/清除、總下注重置、黑名單加入/移除
- **目錄** — 商店物品 CRUD（頭像、稱號、加成、收藏品、寶箱、鑰匙）
- **審核** — 用戶投稿核准/拒絕，核准後自動上架目錄並發放道具
- **活動** — 活動 CRUD，支援 ZXC/YJC/道具/頭像/稱號獎勵設定
- **工單** — 狀態過濾、關鍵字搜尋、管理員回覆更新

#### 持有物品分析頁 (`/inventory`)
- 3 個 Chart.js 圖表：道具類型分布（圓餅圖）、稀有度分布（圓餅圖）、持有價值排行（橫條圖，前 20 名）
- 用戶列表附展開檢視詳細持有物、鑰匙、頭像、稱號、啟用中加成

#### 組合包管理改進 (`/bundles`)
- 道具選擇器改為下拉選單（依稀有度分組）
- 支援調整數量、刪除已選道具

#### UI 統一
- 所有頁面（打錢、查餘額、建立帳號）加上側邊導航欄
- 側邊欄新增「後台管理」入口
- 使用 Chart.js CDN 提供圖表功能
- 延遲載入（lazy load）各標籤頁，改善啟動速度

### 技術細節
- 後台 API 直接透過 SQL 操作資料庫，繞過 Casino API 認證層
- 支援 `support_tickets` 等選用資料表不存在時優雅降級
- 使用 `[System.IO.File]::WriteAllText` UTF-8 確保中文編碼正確
