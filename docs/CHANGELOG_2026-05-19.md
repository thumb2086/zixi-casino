# 2026-05-19 改動紀錄

## Phase 1 — 修復與基礎優化

### 1.1 當舖依實際價值定價
- **檔案**: `packages/shared/src/constants/chests.ts`, `apps/api/src/routes/v1/pawn.ts`, `apps/web/src/features/shop/ShopView.tsx`
- 新增 `getItemPawnValue()` 共用函式，token 物品依面額 70% 典當
- collectible 依稀有度對應最低 token 價值打折
- buff 物品定小額固定價
- 前後端移除硬編碼 PAWN_PRICES

### 1.2 一鍵使用全部 Token 物品
- **檔案**: `apps/api/src/utils/inventory.ts`, `apps/api/src/routes/v1/inventory.ts`, `apps/web/src/features/inventory/ChestView.tsx`
- `useAllTokenItems()` — 一次載入 inventory，掃描全部 token 批量扣減
- `POST /api/v1/inventory/use-all-tokens` API
- 前端代幣分頁加入「全部使用」按鈕 + Max 快捷鍵

### 1.3 股票抵押 UI 強化
- **檔案**: `apps/web/src/features/shop/ShopView.tsx`
- 加入 Sparkline 折線圖、持倉總覽（市值/成本/損益/即時變現）
- 顯示日漲跌%、未實現損益、ROI%、產業標籤

### 1.4 修復 pending intents（admin_debit）
- **檔案**: `apps/worker/src/index.ts`, `apps/worker/src/catchup.ts`
- `admin_debit` 在 worker 中正確路由 user→treasury（先前掉到 else 變成 user→self）
- catchup 工具同步修正

---

## VIP 通行證 & 稱號修復

### VIP pass ❓ 顯示 + 價格扣除
- **檔案**: `packages/shared/src/constants/chests.ts`, `apps/api/src/utils/inventory.ts`, `apps/api/src/routes/v1/inventory.ts`, `apps/web/src/features/shop/ShopView.tsx`, `apps/web/src/features/inventory/ChestView.tsx`
- 新增 `SPECIAL_ITEMS` 註冊表，vip_pass/vip2_pass 加入 ALL_ITEMS/ITEM_INDEX
- 不再顯示為 ❓
- 移除 VIP pass 不扣款的例外，購買時正常扣款

### title_mystic「Item not in inventory」
- **檔案**: `apps/api/src/utils/inventory.ts`
- `useItem` 對 avatar/title 放寬檢查：若已在 ownedAvatars/ownedTitles 中，即使無庫存數量也可裝備

### 物資頁分頁化
- **檔案**: `apps/web/src/features/inventory/ChestView.tsx`
- 改為 4 分頁：寶箱 / 代幣 / 加成 / 收藏

### VIP 制度文件
- **檔案**: `docs/ZIXI_SYSTEM_GUIDE.md`
- 補上完整兩套 VIP 制度說明（Level Tier 32 級 + YJC VIP 3 級 + 通行證）

---

## Phase 2 — 神諭等級 & 寶箱

- **檔案**: `packages/shared/src/constants/chests.ts`, `packages/domain/src/rewards/chest-manager.ts`, `packages/domain/src/rewards/reward-manager.ts`, `apps/api/src/utils/inventory.ts`, `apps/api/src/routes/v1/chests-simple.ts`, `apps/api/src/routes/v1/rewards.ts`, `apps/api/src/routes/v1/admin.ts`, `apps/web/src/features/*.tsx` 等 15 個檔案
- `Rarity` 和 `ChestType` 加入 `"oracle"`
- 神諭寶箱（1 億 ZXC, oracle 保底, 掉落 8-12 個）
- oracle 物品：token_10 億/100 億/1000 億、avatar_oracle/cosmos、title_oracle/cosmic、collectible_blackhole/galaxy/singularity
- 顏色 `#ff0044`，套用至所有前端 RARITY_COLORS/RARITY_STYLES
- 更新 ChestManager 權重陣列、Zod schema、coercePity

---

## Phase 3 — 會員等級 → 稱號系統

### 3.1 鎖定自動發放稱號不從寶箱抽出
- **檔案**: `packages/domain/src/rewards/chest-manager.ts`
- `pickItemFromRarity()` 過濾 `title_member_*`、`title_highroller`、`title_god`

### 3.2 自動發放會員稱號
- **檔案**: `apps/api/src/routes/v1/games/*.ts`（12 個遊戲路由）
- 所有 `updateTotalBet()` 傳入 `userId`，觸發 `checkAndUnlockTitles()`
- 達到 LEVEL_TIERS threshold 時自動 grantBundleToUser

### 3.3 稱號獲得發全域通知
- **檔案**: `apps/api/src/utils/game-settlement.ts`
- `checkAndUnlockTitles()` 中推送系統訊息到 `chat:global:messages`（KV）

### 32 級會員統一
- **檔案**: `packages/shared/src/constants.ts`
- LEVEL_TIERS 加入永恆等級、深淵等級，補滿 32 級

---

## Phase 4 — 聊天取代彈幕 + 全域通知

### 4.1 移除 DanmakuOverlay
- **檔案**: 刪除 `apps/web/src/components/DanmakuOverlay.tsx`、`apps/api/src/routes/v1/danmaku.ts`、`packages/domain/src/danmaku/danmaku-manager.ts`
- 移除 App.tsx 和 index.ts 中所有引用

### 4.2 全域聊天室置底
- **檔案**: `apps/web/src/components/Layout.tsx`
- 底部固定聊天列，顯示最新訊息預覽，點擊展開
- 桌面板保留側邊欄聊天室

### 4.3 贏錢通知
- **檔案**: `apps/api/src/utils/game-settlement.ts`
- `creditPayout()` 接收 game/userId，大額贏錢推送全域聊天

### 4.4 寶箱掉落通知
- **檔案**: `apps/api/src/routes/v1/chests-simple.ts`
- 開出 legendary/mythic/oracle 物品時推送全域聊天

---

## Phase 5 — 交易市場

- **檔案**: `packages/infrastructure/src/db/schema.ts`、`apps/api/src/routes/v1/market-listings.ts`、`apps/web/src/features/shop/ShopView.tsx`
- 新增 `market_listings` 資料表
- API：GET 瀏覽、GET /mine 我的、POST 建立、DELETE 取消、POST /:id/buy 購買
- 平台抽成 5%
- 前端商店新增「交易市場」分頁（瀏覽 / 我的掛賣 / 我要賣表單）

---

## 市場槓桿功能

- **檔案**: `apps/web/src/features/market/MarketView.tsx`、`apps/web/src/features/market/useMarket.ts`
- 下單面板加入現貨/合約切換
- 合約表單：做多/做空、槓桿滑桿 1-20x、保證金輸入、即時顯示名義價值與強平價格
- 合約持倉區塊：顯示未實現損益、入場價/標記價/強平價、平倉按鈕
- 輪詢間隔從 30s 縮短為 5s，交易後立即重取
- 手機股票列表改為 grid-cols-2 雙排
- 持倉移至股票列表上方
- 點股票卡片顯示 48 筆歷史走勢 SVG 折線圖

---

## VIP 顯示 & 排行榜

- **檔案**: `apps/api/src/routes/v1/leaderboard.ts`、`apps/web/src/features/stats/LeaderboardView.tsx`、`apps/web/src/features/casino/LobbyView.tsx`
- 排行榜 API 每筆回傳 `vipLevel`（依 amount 計算 LEVEL_TIERS）
- 排行榜 UI 顯示 VIP 等級 badge（獨立於稱號）
- 大廳儀表板使用者名稱旁顯示 VIP 等級徽章

---

## 部署

所有變更已推送至 `origin/master`，Render 自動部署。
