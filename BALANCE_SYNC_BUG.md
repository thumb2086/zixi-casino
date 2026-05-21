# 餘額同步 Bug 分析

## 問題描述
- **買寶箱 (Buy Chests)**：道具入庫但沒扣錢
- **使用代幣 (Use All Tokens)**：顯示 confirmed 但錢沒入帳

## 系統架構（3 層餘額）

| 層級 | 位置 | 角色 |
|------|------|------|
| 1 | On-chain 智能合約 | 最終正確來源 |
| 2 | `wallet_accounts` (Postgres DB) | 快速讀寫快取 |
| 3 | KV store (`balance:<addr>`) | 遺留 fallback |

## 根因

DB 扣款/加錢後，被 `auth.ts:48` / `market.ts:73` 覆蓋回舊的鏈上值。

## 完整流程

### Bug 1：買寶箱沒扣錢

```
1. POST /api/v1/chests/buy
2. chests-simple.ts:187  → DB 讀取餘額           ✓
3. chests-simple.ts:199  → DB 扣款                ✓
4. chests-simple.ts:202  → 存 tx_intent           ✓
   （但無同步鏈上交易）
5. 後續請求 GET /api/v1/auth/me
6. auth.ts:48            → 讀鏈上餘額（未變）     ✓
7. auth.ts:48            → 寫回 DB（還原成舊值）  ✗ 扣款消失
```

### Bug 2：使用代幣沒加錢

```
1. POST /api/v1/inventory/use-all-tokens
2. inventory.ts:289-291  → DB 加錢                ✓
3. inventory.ts:292-295  → 存 tx_intent           ✓
4. inventory.ts:333-338  → void transferOnChain()  ✗ fire-and-forget
   （鏈上轉帳非同步執行，可能失敗）
5. 後續請求觸發 auth.ts:48  → 鏈上餘額覆蓋 DB     ✗ 加錢消失
```

## 關鍵覆蓋點（寫 on-chain 值回 DB）

| 檔案 | 行號 | 觸發時機 | 行為 |
|------|------|---------|------|
| `apps/api/src/routes/v1/auth.ts` | 48 | `GET /api/v1/auth/me` | 每次寫鏈上 ZXC 餘額回 DB |
| `apps/api/src/routes/v1/market.ts` | 57 | `POST /api/v1/market/action` | KV fallback 寫回 DB |
| `apps/api/src/routes/v1/market.ts` | 73 | `POST /api/v1/market/action` | 鏈上餘額寫回 DB |
| `apps/api/src/routes/v1/wallet.ts` | 111 | 轉帳/提款/兌換後 | `syncBalanceIfKnownUser` 寫鏈上值回 DB |
| `apps/worker/src/sync-down.ts` | 219-231 | 排程 worker | 全部地址寫鏈上值回 DB |
| `apps/worker/src/sync-down.ts` | 246-252 | 排程 worker | 鏈上為 0 時清除 DB |

## 解法（推薦方案）

買寶箱和庫存使用改為**同步執行鏈上轉帳**，讓鏈上餘額跟著變，後續 `auth.ts:48` 同步回來時就是正確值。

### 需修改的檔案

| 檔案 | 修改內容 |
|------|---------|
| `apps/api/src/routes/v1/chests-simple.ts` | `/buy` 完成 DB 扣款後，同步調用 `adminTransfer` 燒幣 |
| `apps/api/src/routes/v1/inventory.ts` | `use-all-tokens` 移除 `void`，`await` 鏈上轉帳完成後再回傳 |
| `apps/api/src/routes/v1/auth.ts` | (備用) 有 pending `admin_debit`/`admin_credit` 時跳過 overwrite |

### 次要問題

- `walletRepo.updateBalance()` 無交易隔離，並發請求有 race condition
- 方法名 `updateBalance` 誤導（實為設為絕對值，非增量）
- `sync-down.ts` 會摧毀所有 DB-only 的狀態變更

## 受影響檔案完整列表

- `apps/api/src/routes/v1/chests-simple.ts`
- `apps/api/src/routes/v1/inventory.ts`
- `apps/api/src/routes/v1/auth.ts`
- `apps/api/src/routes/v1/market.ts`
- `apps/api/src/routes/v1/wallet.ts`
- `apps/api/src/utils/game-settlement.ts`
- `packages/infrastructure/src/db/index.ts`
- `apps/worker/src/sync-down.ts`
