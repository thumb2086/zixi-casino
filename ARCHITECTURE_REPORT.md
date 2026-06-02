# Zixi-casino 整體架構缺陷分析報告

> 生成日期: 2026-06-02 | 基於實際程式碼審查，附行號引用

---

## 一、最根本的問題：三層餘額系統沒有單一 Source of Truth

### 證據

**Layer 1 — On-chain（智能合約）**
- `auth.ts:59` — `/me` 每次呼叫都用鏈上值覆蓋 DB：`await walletRepo.updateBalance(address, onchainBalance, "zhixi")`
- 雖然有 `hasPendingAdmin` 檢查（L52-57），但這只是 patch 不是架構解決方案

**Layer 2 — Postgres (wallet_accounts)**
- `game-settlement.ts:101` — `setBalance` 直接覆蓋 DB 值：`updateBalance(normalizedAddress, balance, token)` 
- `game-settlement.ts:178` — `adjustBalanceAtomic` 用 SQL `UPDATE SET balance = balance ± delta WHERE balance >= delta` 做原子加減

**Layer 3 — KV store（遺留）**
- `market.ts:49` — `kv.get<string | number>(\`balance:${address}\`)` 仍作為 fallback 讀取
- `market.ts:56-57` — 如果 KV 有值而 DB 沒有，`walletRepo.updateBalance(address, fallbackBalance, "zhixi")`

### 矛盾

**`auth.ts:34-64`** (`getLiveZhixiBalance`):
```typescript
// L42-47: 查鏈上餘額
const onchainBalance = client.formatUnits(
    await client.getBalance(address, tokenRuntime.contractAddress), decimals
);
// L52-57: 如果有 pending intents，跳過覆蓋（patch）
if (hasPendingAdmin) return (await walletRepo.getBalance(address, "zhixi")) || "0";
// L59: 否則用鏈上值覆蓋 DB
await walletRepo.updateBalance(address, onchainBalance, "zhixi");
```

**後果**: 使用 `setBalance`（DB only）的操作（如 chest compensation、mission reward、gift）會在下次 `/auth/me` 或 `/wallet/summary` 時被鏈上舊值覆蓋，除非 pending intent 恰好在場。這不是 bug，是架構設計的矛盾。

---

## 二、Admin 錢包模式：中心化但缺乏隔離

### 證據

**所有鏈上轉帳都透過同一把 admin 私鑰**:
- `wallet.ts:478` — `client.adminTransfer(fromAddress, toAddress, amountWei, ...)`
- `auth.ts:209` — `client.adminTransfer(treasuryAddress, address, amountWei, ...)`
- `admin.ts:280` — `client.mint(normalized, deficitWei, tokenRuntime.contractAddress)`

**私鑰在共享 PaaS 上**:
- `render.yaml:6-7` — `plan: free`, `region: oregon` — Render 免費方案
- `admin.ts:248-252` — 每次操作從 env 讀取 RPC_URL 和 ADMIN_PRIVATE_KEY

**問題**: 一把私鑰控制所有用戶資金。私鑰洩露 = 所有資金全滅。

---

## 三、單體 API 做了太多事

### 證據

**`apps/api/src/index.ts:134-172`** — 37 個 route 註冊在同一 Fastify 實例：

```typescript
fastify.register(authRoutes,       { prefix: "/api/v1/auth" });       // L135
fastify.register(walletRoutes,     { prefix: "/api/v1/wallet" });     // L136
fastify.register(gameRoutes,       { prefix: "/api/v1/games" });      // L137
fastify.register(marketRoutes,     { prefix: "/api/v1/market" });     // L138
fastify.register(rewardRoutes,     { prefix: "/api/v1/rewards" });    // L139
fastify.register(adminRoutes,      { prefix: "/api/v1/admin" });      // L142
fastify.register(supportRoutes,    { prefix: "/api/v1/support" });    // L143
// +11 個遊戲路由 (L153-164), + chests, inventory, pawn, gift, missions...
```

同一 process 同時處理：
- 12 個遊戲結算（同步 DB 操作）
- 市場模擬（記憶體運算 + DB I/O）
- 管理後台（敏感操作）
- SSE 聊天長連線（佔用連線）
- 沒有 rate limiting

---

## 四、Worker 沒有被部署

### 證據

**`render.yaml`**（僅 16 行）:
```yaml
services:
  - type: web
    name: zixi-casino-api
    plan: free
```
**只有一個 web service，沒有 worker。**

**Worker 程式碼存在但未使用**:
- `apps/worker/src/index.ts:159-165`:
```typescript
async function main() {
  while (true) {
    await processIntents();
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
```
Worker 會每 5 秒處理 pending/failed tx_intents，但不存在於 render.yaml。

**後果**: 所有 `tx_intent` 不會被自動處理。鏈上餘額永遠不會同步。

---

## 五、Session 沒有過期機制

### 證據

**`auth.ts:320-327`**:
```typescript
typedFastify.get("/status", async (request) => {
    const session = await sessionRepo.getSessionById(sessionId);
    if (!session) return createApiEnvelope({ status: "expired" }, request.id);
    return createApiEnvelope({ status: session.status, ... }, request.id);
});
```

Session 只檢查「是否存在」，沒有 TTL 或過期時間判斷。一旦授權就永久有效。

---

## 六、setBalance 直接覆蓋值，與 adjustBalanceAtomic 共存

### 證據

**`game-settlement.ts:99-102`**:
```typescript
async setBalance(address, token, balance): Promise<void> {
    await this.walletRepo.updateBalance(normalizedAddress, balance, token);
}
```

**`packages/infrastructure/src/db/index.ts:766-781`** (`updateBalance`):
```typescript
// 直接設定（非原子）
await conn.insert(schema.walletAccounts).values({...})
    .onConflictDoUpdate({
        target: [...],
        set: { balance: amount, updatedAt: new Date() }  // 直接覆蓋
    });
```

**同時存在原子操作** (`adjustBalanceAtomic`, L783-803):
```sql
UPDATE wallet_accounts SET balance = balance ± delta WHERE address = addr
```

兩個 API 共存：前者（setBalance）用於 missions/gift/chests，後者用於遊戲結算。並發時 setBalance 會覆蓋 adjustBalanceAtomic 的結果。

---

## 七、管理後台沒有 Middleware 層保護

### 證據

**`admin.ts:46-73`** — 每個 endpoint 手動檢查：
```typescript
const getAdminContext = async (req: any) => {
    const sessionId = req.headers["x-session-id"] || ...;
    // ... 手動驗證
};
```

**34 次手動呼叫**（admin.ts 中 `getAdminContext` 出現 34 次）：
```
L100, L131, L184, L230, L338, L351, L373, L407, L429, L461, L506,
L517, L536, L561, L625, L658, L694, L737, L771, L793, L814, L852,
L885, L907, L1000, L1009, L1023, L1036, L1059, L1091, L1139, L1167, L1201
```

沒有 Fastify `preHandler` hook、沒有 IP whitelist、沒有 VPN。

---

## 八、市場價格是純記憶體模擬

### 證據

**`packages/domain/src/market/market-manager.ts:324`**:
```typescript
buildSnapshot(nowTs = Date.now()): MarketSnapshot {
    // ...根據當前時間 + 種子計算，無持久化
}
```

沒有價格歷史記錄。Render 每次 redeploy 或 spin-down 重啟後所有價格重置。

---

## 九、核心套件不在 git 追蹤

README.md 明確指出 `packages/domain`、`packages/infrastructure`、`packages/on-chain` 的 `src/` 未追蹤。`AGENTS.md` 也承認：

> `packages/domain/` — Business logic managers (src untracked)
> `packages/infrastructure/` — DB schema, DB client, KV, chain, repos (src untracked)
> Build limitation: Only `@repo/shared` + `web` can build from tracked files

核心業務邏輯無版本控制。

---

## 十、每個遊戲路由都有自己的 getContext()

### 證據

**完全相同的 10+ 份 `getContext` 覆製貼上**:

| 檔案 | 行號 | 程式碼 |
|------|------|--------|
| `slots.ts` | 17-29 | 2 DB queries (sessions + users) |
| `roulette.ts` | 22-34 | 同上 |
| `horse.ts` | 16-28 | 同上 |
| `crash.ts` | 15-27 | 同上 |
| `blackjack.ts` | 15-27 | 同上 |
| 另有 bingo, duel, bluffdice, sicbo, poker, shoot-dragon-gate | — | 推測相同模式 |

每個遊戲路由每次請求都做兩次 DB query 做 session lookup。

---

## 十一、Roulette/Horse 同步結算 vs Slots 非同步

**Slots** (`slots.ts:100-173`): 先回應 → 背景 `void (async () => {...})()` 處理結算/XP/日誌

**Roulette** (`roulette.ts:105-218`): 全部 await 串行：
```typescript
const settlement = await executeSettlement(...);  // L117
await creditPayout(...);                          // L140
await updateTotalBet(...);                        // L151
await recordGame(...);                            // L156
await logGameEvent(...);                          // L178
await saveRound(...);                             // L193
return response;                                  // L200 // 最後才回應
```

使用者要等全部 5 步 DB/RPC 操作完成才看到結果。

---

## 十二、Slots 前端 Auto-Spin 串行 + 每局 invalidate

**`SlotsView.tsx:187-206`** — 自動旋轉是串行 `for...await` loop：
```typescript
for (let i = 0; i < autoCount; i++) {
    await doSingleSpin();  // 等 API 回來才送下一局
}
```

**`SlotsView.tsx:79-80`** — 每局結束都觸發 refetch：
```typescript
queryClient.invalidateQueries({ queryKey: ['user'] });
queryClient.invalidateQueries({ queryKey: ['my-profile'] });
```

自動 x50 → 50 次 refetch `/me/profile`（每局都無視 staleTime）。

---

## 修復建議優先順序

| Priority | 缺陷 | 方案 | 預計工時 |
|----------|------|------|----------|
| 🔴 P0 | 三層餘額無 SSOT | 選 DB wallet_accounts 為唯一 source；移除 auth.ts 和 market.ts 中「鏈上覆蓋 DB」的邏輯；所有寫入都走 `adjustBalanceAtomic` | 3-5 天 |
| 🔴 P0 | Worker 沒部署 | render.yaml 加入 worker service；game-settlement 中 fire-and-forget 改為 await | 1 天 |
| 🔴 P1 | getContext 重複 10+ 次 | Fastify `preHandler` hook 統一 session 驗證，結果存在 `request.user` | 1 天 |
| 🔴 P1 | Roulette/Horse 同步結算 | 比照 Slots 改 async background | 1 天 |
| 🟠 P2 | Autospin 串行 | pipeline 模式：不等前一局 API 回應就送下一局 | 0.5 天 |
| 🟠 P2 | 每局 invalidate | 改為 API 回傳直接更新 local store | 0.5 天 |
| 🟠 P2 | Session 無 TTL | 加入 createdAt + expiresAt 檢查 | 1 天 |
| 🟡 P3 | Admin middleware | 加入 Fastify `preHandler` + IP whitelist | 1 天 |
| 🟡 P3 | 市場無持久化 | market snapshot 寫入 DB，啟動時從 DB 恢復 | 2 天 |
| 🔵 P4 | 核心套件未追蹤 | .gitignore 移除 packages/domain/src 和 infrastructure/src | 1 天 |
