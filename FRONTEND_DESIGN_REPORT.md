# Zixi-casino 前端設計分析報告

> 生成日期: 2026-06-02 | 基於實際程式碼審查

---

## 1. 字體粗細層級崩潰 — `font-black` 泛濫

### 證據

`index.css:114` 定義的 `section-title-text` 預設為 `font-black`，而此 class 被用於所有 section headings。

**WalletView.tsx** — 幾乎所有文字都是 `font-black`：
```
L36:  AssetCard label          → font-black uppercase tracking-[0.2em]
L124: Shop link                → font-black uppercase tracking-[0.18em]
L127: Swap link                → font-black uppercase tracking-[0.18em]
L139: "總資產" label            → font-black uppercase tracking-[0.3em]
L158: "經驗等級" label          → font-black uppercase tracking-[0.18em]
L180: "每日空投" heading        → font-black uppercase tracking-[0.18em]
L214: claim 按鈕               → font-black uppercase tracking-[0.15em]
L228: "交易紀錄" heading        → font-black uppercase tracking-[0.18em]
L259: "轉帳" heading            → font-black uppercase tracking-[0.18em]
L288: 轉帳送出按鈕              → font-black uppercase tracking-[0.15em]
```

**LobbyView.tsx**:
```
L208: "operator_identified"    → font-bold uppercase tracking-[0.3em]
L228: 資產數字 (text-5xl)       → font-black uppercase italic tracking-tighter
L253: VIP等級數字 (text-3xl)    → font-black italic
L263: XP 數字                  → font-bold
L295: 任務獎勵數字              → font-bold
L303: "領取"按鈕               → font-bold
L351: inventory item name      → font-bold (在 text-[7px] 上)
```

**LoginView.tsx**:
```
L196: 公告欄 heading            → font-black uppercase tracking-[0.3em]
L220: "緊急" tag               → font-black bg-accent text-black (text-[8px])
L235: "more info" footer       → font-bold text-muted uppercase tracking-[0.3em]
L271: subtitle                 → font-bold uppercase tracking-[0.4em]
L316: "open app" 按鈕          → font-black uppercase tracking-widest
L323: "encrypted active"       → font-bold uppercase tracking-[0.2em]
```

**SwapView.tsx**:
```
L57:  title                    → font-black uppercase tracking-widest
L58:  rate label               → font-black uppercase tracking-widest
L70:  "支付" label              → font-black uppercase tracking-widest
L79:  input amount             → font-black italic (text-2xl)
L82:  symbol label             → font-black
L99:  "接收" label              → font-black
L103: preview amount           → font-black italic (text-2xl)
L106: symbol label             → font-black
L113: submit button            → font-black uppercase tracking-widest
L222: balance title            → font-black uppercase tracking-widest
L226: ZXC balance              → font-black italic
L231: YJC balance              → font-black italic
```

**結論**: `font-black`(900) 被用於標題、按鈕、說明文字、標籤、數字等所有文字元素。`font-bold`(700) 也被普遍用於次要文字。很少有 `font-medium`(500) 或 `font-normal`(400) 出現。視覺層級完全喪失。

---

## 2. 字體大小碎片化 — 無統一比例尺

### 證據

跨檔案搜尋結果：

| 大小 | 匹配次數 | 使用範例 |
|------|---------|---------|
| `text-[7px]` | 1 | LobbyView L351: inventory 道具名稱 |
| `text-[8px]` | 9 | LoginView (tags), HealthView (指標標籤), ProfileSetup |
| `text-[9px]` | 9 | WalletView (日曆格), PerformanceView, CompanyView, Poker/BluffDice rooms |
| `text-[10px]` | 63 | 遍布所有頁面 — 明細文字、輔助說明、按鈕 |
| `text-[11px]` | 1 | LobbyView L415: company description |

加上標準 Tailwind 大小也在混用：`text-xs`(12px), `text-sm`(14px), `text-lg`(18px), `text-xl`(20px), `text-2xl`(24px), `text-3xl`(30px), `text-4xl`(36px), `text-5xl`(48px)。

整個應用沒有統一的文字比例尺。`text-[10px]` 出現 63 次代表它已經變成事實上的「小字」標準，但卻是用 arbitrary value 而非設計 token。

---

## 3. accent 金色過度濫用

### 證據

`tailwind.config.js:15` 定義 `accent: rgba(var(--color-accent-rgb), <alpha-value>)`，色值為 `#f5a623` (金黃色)。

accent 被用於以下所有場景（非完整列表）：

**LobbyView.tsx**:
- Header 裝飾 icon (L187): `text-accent`
- 主標題 (L189): `text-accent`
- 用戶頭像 border (L195): `border-accent/20`
- 用戶圖示 (L197): `text-accent`
- "operator_identified" 文字 (L208): `text-accent`
- Hero 區 background (L203): `border-accent/10` + 光暈 `bg-accent/5`
- VIP badge 動畫脈動點 (L219): `bg-accent`
- 總資產數字 (L228): `text-accent`
- 銀行 icon (L233): `text-accent`
- XP 數字 (L253): `text-accent`
- XP 進度條 (L268): gradient 含 `#fcc025` + `shadow-[0_0_10px_rgba(252,192,37,0.4)]`
- 任務獎勵數字 (L295): `text-accent`
- "領取"按鈕 (L303): `bg-accent`
- 任務進度條 (L298): `bg-gradient-to-r from-[#fcc025] to-[#e6ad03]`
- GlassCard icon 背景 (L61): `text-accent`
- GlassCard 左側色條 (L56): `border-l-[#fcc025]/40`
- "no activity" icon (L320): `text-accent`
- 公告 icon (L364): `text-accent`
- "system secure" 文字 (L437): `text-accent`
- 管理員 section 脈動點 (L436): `bg-accent`

**SwapView.tsx**:
- swap 方向切換按鈕 (L90): `bg-accent`
- 所有 symbol 標籤 (L82, L106): `text-accent`
- 預覽金額 (L103): `text-accent italic`
- 提交按鈕 (L113): `bg-accent`
- ZXC/YJC 餘額 (L227, L231): `text-accent`
- 所有 icon (L212, L221): `text-accent`
- 標題 (L213): `text-accent`
- swap panel border (L55): `border-accent/20`
- rate label (L58): `text-accent`

**LoginView.tsx**:
- 語言切換按鈕 (L179): `text-accent` + `border-accent/20`
- 公告欄 accent 脈動點 (L195): `bg-accent`
- 公告欄 heading (L196): `text-accent`
- 緊急公告 border (L218): `border-accent/20`
- 緊急 tag (L220): `bg-accent text-black`
- 指紋 icon (L268): `text-accent`
- 標題 (L270): `text-accent`
- Tab 切換 active (L277): `bg-accent text-black`
- QR code 外框 (L298): `from-[#fcc025] to-[#e6ad03]`
- "open app" 按鈕 (L316): `border-accent/20 text-accent`
- "encrypted active" (L323): `text-accent/60`
- label (L353, L369, L387): `text-accent`
- 輸入框 focus border (L363): `focus:border-accent/50` + `focus:ring-[#fcc025]/5`
- 送出按鈕 (L435): `from-[#fcc025] to-[#e6ad03]` + `shadow-[0_4px_20px_rgba(252,192,37,0.2)]`
- checkbox checked (L411): `border-accent bg-accent`
- 頁尾 (L468-470): `tracking-[0.5em]` + `text-accent/30`

**結論**: 金色從強調色變成了主要色。當所有東西都是金色，就沒有東西是重要的了。

---

## 4. Hero 卡片資訊密度過低

**LobbyView.tsx L203-243**:

Hero 區塊佔了大約 240px 的垂直高度（含 padding），但只展示了：
- 一小段「operator identified」文字（僅 5 個英文字）
- 用戶名（一行）
- VIP badge + 脈衝動畫圓點
- 總資產數字（5rem/48px 大字）
- 銀行餘額 + 股票價值（小字）

相對於佔據的畫面空間，實際資訊量很少。`text-5xl` 的資產數字（L228）搭配 `italic font-black tracking-tighter` 極度搶眼，但其下方的銀行/股票數字只有 `text-xs font-bold`，視覺權重反差太大。

---

## 5. 底部導覽列 6 項 — 手機上過窄

**AppBottomNav.tsx L10-17**:
```typescript
const items = [
    { key: 'home', label: t('nav.dashboard') },
    { key: 'casino', label: t('nav.casino') },
    { key: 'market', label: t('nav.market') },
    { key: 'shop', label: t('nav.shop') },
    { key: 'wallet', label: t('nav.vault') },
    { key: 'settings', label: t('nav.settings') },
];
```

6 個項目，每個 `flex-1`。在 375px 手機上：
- 每個項目寬度 ≈ 62px
- Label 使用 `truncate`（L35），文字過長時會被截斷
- 同排 icon(24px) + truncate label，資訊密度過高
- 標準 UI 指南建議底部導覽最多 5 項

---

## 6. 卡片邊框不一致

**GlassCard** (`LobbyView.tsx L55-56`):
```typescript
border ? 'border-l-4 border-l-[#fcc025]/40' : 'border border-border/10'
```
兩種風格：左側金邊 / 全框。

**LobbyView 任務卡片** (`LobbyView.tsx L289`):
```typescript
locked  ? 'border-border/10 opacity-50'
done    ? 'border-accent/40'
normal  ? 'border-border/20'
```
三種透明度混用。

**WalletView**:
- `border-border/10` (L155, L177, L224, L239, L256)
- `border-border/20` (L266, L269)

**SwapView**:
- `border-accent/20` (L55)
- `border-border/20` (L68, L97, L225, L229)
- `border-border/10` (Wallet sections)

**LobbyView Hero** (`L203`): `border-accent/10`

總計在同一產品中出現的邊框透明度：`/10`、`/15`、`/20`、`/40`、`/50`，加上左側色條 (`border-l-4`) 和頂部色條 (`card-accent::before` 3px bar)。

---

## 7. 遊戲頁面風格脫節

**Coinflip.css** (獨立 CSS，119 行):
```css
.coinflip-container { background: #0d1117; }
.coin-front { background: #ffcc00; }
.btn-choice { background: #1a1a1a; border: 2px solid #333; }
.btn-play { background: linear-gradient(180deg, #ffcc00, #d4a017); }
```
- 背景 `#0d1117` 而非主應用的 `#0e0e0e` / `bg-surface`
- 不使用任何 Tailwind theme token
- 按鈕使用古典賭場金黃漸層
- 邊框用 `2px solid #333` 而非 `border-border/XX`

**Crash.css** (獨立 CSS，166 行):
```css
.crash-container { background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(148, 163, 184, 0.1); }
.crash-display { border: 4px solid #3b82f6; background: radial-gradient(circle, #1e293b 0%, #0f172a 100%); }
.bet-btn { background: #3b82f6; }
.cashout-btn { background: #22c55e; }
```
- 使用 slate 色系 (`#0f172a`, `#1e293b`, `#334155`) 而非主應用的深黑
- 按鈕使用藍色 (`#3b82f6`) 和綠色 (`#22c55e`) 而非主應用的金色
- 圓形顯示器設計語言與其他頁面完全不同

**其他遊戲 CSS 檔案**：Slots.css, Sicbo.css, Roulette.css, Poker.css, HorseRacing.css, Duel.css, DragonTiger.css, BluffDice.css, Blackjack.css, Bingo.css — 每個都是獨立 CSS，顏色和風格各自為政。

---

## 8. tracking 過度使用

### 分佈統計

總計 `tracking-[...]` 出現 **109 次**，分佈在約 25 個檔案中。

| tracking 值 | 使用頻率 | 代表位置 |
|------------|---------|---------|
| `[0.5em]` | 3 | Layout.tsx L61, LoginView L468, SettingsView L438 |
| `[0.4em]` | 1 | LoginView L271 |
| `[0.3em]` | ~20 | LoginView L196, L235; LobbyView L208; WalletView L139; HealthView L41-L53, L89; RewardsView L81 |
| `[0.2em]` | ~40 | 遍布 ChestView, InfoView, ItemsCatalogView, OddsTab, SettingsView |
| `[0.18em]` | ~15 | WalletView, XpTab, AnnouncementCenter, MarketView |
| `[0.16em]` | 1 | WalletView L143 |
| `[0.15em]` | ~8 | WalletView L214, L288; MarketView buttons |
| `[0.14em]` | ~8 | MarketView, AnnouncementCenter |
| `[0.12em]` | ~8 | AnnouncementCenter, MarketView, SettingsView |

`tracking-[0.3em]` 以上（含 0.3）套在中文上會讓字距過大難以閱讀。LoginView 同時使用了 `tracking-[0.5em]`（L468 頁尾）和 `tracking-[0.4em]`（L271 subtitle），這些值套在中文字串上會極度寬鬆。

---

## 9. 動畫衝突

### 同時活躍的動畫類型

| 動畫 | 位置 | 效果 |
|------|------|------|
| `animate-pulse` | LobbyView L219 (加密圓點), LoginView L195 (公告圓點), AdminView | 持續脈動 |
| `blur-[100px]` | LobbyView L204 (Hero 光暈) | 大面積模糊光暈 |
| `transition-all` | LobbyView L268 (進度條), L55 (卡片 hover) | 過渡動畫 |
| `active:scale-95` | LobbyView L55 (卡片點擊), L186 (header icon) | 點擊縮放 |
| `whileHover={{ scale: 1.05 }}` | LoginView L176 (語言切換), L431 (送出按鈕) | hover 放大 |
| `group-hover:scale-105` | LoginView L300 (QR code) | hover 縮放 |
| `whileTap={{ scale: 0.95 }}` | LoginView L177 | 點擊縮放 |
| `group-hover:translate-y-full` | LoginView L437 (按鈕 overlay) | hover 滑入效果 |
| `animate-spin` | LoginView L305 (載入中) | 旋轉 |
| `shadow-[0_0_15px_rgba(252,192,37,0.1)]` | LobbyView L195 | 光影動態 |

**問題**: LobbyView hero 區同時間有：脈動圓點 + 模糊光暈 + 卡片 hover 縮放 + 進度條 transition。使用者會同時看到多個元素在動，整體感覺「躁動」。

---

## 10. SwapView Toast 定位問題

**SwapView.tsx L120-123**:
```tsx
{result && (
  <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl
    bg-card border border-accent/40 shadow-lg shadow-black/50 text-sm font-bold
    text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
    {result}
  </div>
)}
```

**問題**：
1. Toast 定義在 `SwapPanel` 元件內部（L20），但使用的 `fixed` 定位相對於視窗而非 SwapPanel
2. 依賴 `bottom-24` 硬編碼位置，與底部導覽列高度耦合
3. 同一個應用中，ChestView 使用不同的 toast 實現（L126: `toastMsg` state + 不同樣式）
4. 沒有全局 toast provider，每個頁面各自實現

---

## 摘要與修復建議

| # | 問題 | 嚴重度 | 影響 |
|---|------|--------|------|
| 1 | `font-black` 泛濫，無層級 | 🔴 高 | 整體可讀性 |
| 2 | 字體大小碎片化（7px~11px arbitrary） | 🟠 中 | 可讀性/維護性 |
| 3 | accent 金色過度使用 | 🟠 中 | 視覺清晰度 |
| 4 | Hero 區資訊密度低 | 🟡 低 | 空間效率 |
| 5 | 底部導覽 6 項 | 🔴 高 | 手機可用性 |
| 6 | 邊框透明度不一致 | 🟡 低 | 細節完整性 |
| 7 | 遊戲頁面風格脫節 | 🔴 高 | 品牌一致性 |
| 8 | tracking 過度（含中文 0.5em） | 🟡 低 | 中文可讀性 |
| 9 | 動畫衝突/過多 | 🟡 低 | UX 品質 |
| 10 | Toast 位置邏輯不一致 | 🟡 低 | UX 細節 |

### 優先修復

**Phase 1** — 立即見效：
1. **建立 Typography Scale**：定義 `text-caption`(10px)、`text-body`(12px)、`text-sub`(14px)、`text-h4`(16px) 等 token，取代所有 arbitrary px 值
2. **限縮 `font-black` 使用**：標題用 `font-bold`(700) 或 `font-extrabold`(800)，說明文字用 `font-medium`(500) 或 `font-normal`(400)。保留 `font-black` 僅用於極少數強調數字（如資產總額）
3. **建立 accent 使用守則**：accent 只用於 CTA 按鈕、導覽 active 狀態、關鍵數字。一般標題改用 `text-white`

**Phase 2** — 結構性改進：
4. **合併遊戲 CSS**：將 Coinflip.css、Crash.css 等改用 Tailwind theme tokens
5. **底部導覽減為 5 項**：合併「shop」和「market」，或將一個移至 header
6. **統一邊框 token**：定義 `border-subtle`(/10)、`border-default`(/20)、`border-strong`(/40) 三個等級

**Phase 3** — UX 打磨：
7. **全局 Toast Provider**：統一各頁面的 toast 實現
8. **動畫節奏控制**：每個頁面最多 1-2 個同時動畫
9. **中文 tracking 上限**：中文文字 `tracking` 不超過 `[0.1em]`
