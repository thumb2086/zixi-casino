# Zixi Casino 開發路線圖

## Phase 1 — 修復與基礎優化

### 1.1 當舖改依實際價值定價
**檔案**：`apps/api/src/routes/v1/pawn.ts`, `apps/web/src/features/shop/ShopView.tsx`

- 目前典當用固定價格（common=10, rare=50, epic=250, legendary=1000, mythic=5000）
- 改為依物品實際價值（token 面額）打折
- 收藏品依稀有度對應 token 物品的價值計算
- 典當 = 價值 × 折扣（如 70%）
- 賣掉 = 官方原價

### 1.2 一鍵使用全部 Token 物品
**檔案**：`apps/api/src/utils/inventory.ts`, `apps/web/src/features/inventory/ChestView.tsx`

- 背包新增「全部使用」按鈕
- 掃描所有 `token_*` 物品批次使用
- 加總金額寫入錢包 + 建立鏈上交易記錄
- 進度條顯示處理狀態

### 1.3 股票抵押 UI 強化
**檔案**：`apps/web/src/features/shop/ShopView.tsx`

- 股票典當已存在（市價 70%），改善前端顯示
- 加上即時市值試算、折線圖等

### 1.4 修復 pending intents 處理
**檔案**：`apps/api/src/utils/game-settlement.ts`

- 補上 `admin_credit` / `admin_debit` 類型在 `processQueuedIntents` 的處理
- 手動處理殘留的 pending intents（Gg 帳戶等）

---

## Phase 2 — 神諭等級 & 寶箱

### 2.1 新增 Rarity: oracle
**檔案**：`packages/shared/src/constants/chests.ts`

```typescript
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic" | "oracle";
```

- `RARITY_NAMES` 加入 oracle 顏色（如 `#ff0000` 金色紅）
- `ITEM_DROP_TABLES` 加入 oracle 分頁

### 2.2 神諭等級物品
**檔案**：`packages/shared/src/constants/chests.ts`

高價值 token 物品（oracle 稀有度）：

| Item ID | 名稱 | 價值 |
|---------|------|------|
| `token_1000000000` | 10 億 ZXC | 1,000,000,000 |
| `token_10000000000` | 100 億 ZXC | 10,000,000,000 |
| `token_100000000000` | 1,000 億 ZXC | 100,000,000,000 |

神諭級 avatar/title/collectible：

| Item ID | 名稱 | 類型 |
|---------|------|------|
| `avatar_oracle` | 神諭 | avatar |
| `avatar_cosmos` | 宇宙 | avatar |
| `title_oracle` | 神諭者 | title |
| `title_cosmic` | 宇宙主宰 | title |
| `collectible_blackhole` | 黑洞 | collectible |
| `collectible_galaxy` | 銀河 | collectible |
| `collectible_singularity` | 奇點 | collectible |

### 2.3 神諭寶箱
**檔案**：`packages/shared/src/constants/chests.ts`, `apps/api/src/routes/v1/chests-simple.ts`

```typescript
oracle: {
  id: "oracle",
  name: "神諭寶箱",
  price: 100_000_000, // 1 億 ZXC
  guaranteedRarity: "oracle",
  pityThreshold: 1,
  dropCount: { min: 8, max: 12 },
  weights: {
    common: 0, rare: 0, epic: 0,
    legendary: 200, mythic: 500, oracle: 300,
  },
}
```

### 2.4 前端支援 oracle 稀有度
**檔案**：`apps/web/src/features/shop/ShopView.tsx`, `apps/web/src/features/inventory/ChestView.tsx`

- 顏色、樣式、圖示
- 寶箱購買流程支援 oracle

---

## Phase 3 — 會員等級 → 稱號系統

### 3.1 鎖定 title_member_N 不從寶箱抽出
**檔案**：`apps/api/src/utils/inventory.ts`

- 開寶箱 drop 邏輯排除 `title_member_*`
- `ITEM_DROP_TABLES` 中的 `title_member_*` 移到獨立區塊

### 3.2 自動發放會員稱號
**檔案**：`apps/api/src/utils/game-settlement.ts`

- `updateTotalBet` 內檢查 `LEVEL_TIERS` threshold
- 達標時自動 `grantBundleToUser` 發放對應 `title_member_N`
- `LEVEL_TIERS` 目前 29 級，前端顯示 32 級 → 統一

```typescript
// 押注 threshold → 稱號對應（範例）
// threshold 0 → title_member_1（普通會員）
// threshold 10,000 → title_member_2（青銅會員）
// ...
```

### 3.3 稱號獲得發全域通知
**檔案**：`apps/api/src/utils/game-settlement.ts`, `apps/api/src/routes/v1/support.ts`

- 自動發放時推送到全域聊天室 KV

---

## Phase 4 — 聊天取代彈幕 + 全域通知

### 4.1 移除 DanmakuOverlay
**檔案**：`apps/web/src/components/DanmakuOverlay.tsx`, `apps/web/src/App.tsx`

- 刪除彈幕浮層元件
- 刪除 `apps/api/src/routes/v1/danmaku.ts`
- 刪除 `packages/domain/src/danmaku/`

### 4.2 全域聊天室置底
**檔案**：`apps/web/src/components/ChatRoom.tsx`, `apps/web/src/components/Layout.tsx`

- 現有 `ChatRoom` 升級為全域聊天
- 固定在底部（類似 AppBottomNav 上方）
- 所有頁面可見
- 支援收合/展開

### 4.3 贏錢通知
**檔案**：`apps/api/src/routes/v1/games/*.ts`

- 每局遊戲結算時推送到全域聊天 KV
- 格式：`「{用戶名} 在 {遊戲} 贏了 {金額} ZXC！」`

### 4.4 物品/稱號獲得通知
**檔案**：`apps/api/src/utils/inventory.ts`

- 使用物品、開啟寶箱時推送通知
- 格式：`「{用戶名} 抽到了 {物品名稱}！」`

### 4.5 送禮通知
**狀態**：✅ 已存在（`gift.ts` 會發系統訊息）

---

## Phase 5 — 交易市場

### 5.1 商店分頁「交易市場」
**檔案**：`apps/web/src/features/shop/ShopView.tsx`

- 新增第三個分頁（商城 / 當舖 / 交易市場）
- 玩家掛賣物品/收藏品
- 買方出價、賣方接受
- 平台抽成（可設定）

### 5.2 掛賣 API
**檔案**：`apps/api/src/routes/v1/market.ts`

- `POST /api/v1/market/listings` — 建立掛賣
- `GET /api/v1/market/listings` — 取得掛賣列表
- `POST /api/v1/market/listings/:id/buy` — 購買
- `DELETE /api/v1/market/listings/:id` — 取消掛賣

### 5.3 資料表
**檔案**：`packages/infrastructure/src/db/schema.ts`

```typescript
export const marketListings = pgTable("market_listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  itemId: text("item_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  price: numeric("price").notNull(),
  token: text("token").notNull().default("zhixi"),
  status: text("status").notNull().default("active"), // active, sold, cancelled
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

---

## Phase 6 — 遺留問題

### 6.1 pending intents 處理
- 檢查所有 status = pending 的 tx_intents
- 補上鏈或標記為失敗
- 確保 `admin_credit` / `admin_debit` 類型被 worker 正確處理

### 6.2 遊戲 session 紀錄留存
- `game_sessions` 表已建立 ✅
- 確保所有遊戲正常寫入（已經可運作）

### 6.3 32 級會員統一
- `LEVEL_TIERS` 目前 29 級，前端 VIPTab 寫 32 級
- 統一兩邊數量與 threshold 值

---

## 技術注意事項

### 編碼
- 所有 `.tsx` / `.ts` 檔案必須用 **UTF-8 without BOM**
- 禁止使用 PowerShell `Set-Content` 改寫含中文的檔案（會破壞編碼）
- 改用 node.js `writeFileSync(path, content, 'utf8')` 或 VS Code 直接編輯

### 鏈上交易
- `admin_credit` / `admin_debit` 類型需在 worker 中註冊處理
- 或直接呼叫合約 transfer 後更新狀態
- 管理員私鑰在 `.env` 中設定，禁止寫死在程式碼或腳本中

### 資料庫
- Neon PostgreSQL，使用 `postgres.js` 客戶端
- Schema 定義在 `packages/infrastructure/src/db/schema.ts`
- 啟動時 `ensureCoreSchema` 會自動建立缺少的表格
- 新增表格時需要在 `isCoreSchemaReady` 檢查清單中加入
