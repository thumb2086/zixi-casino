# ZIXI CASINO — 半導體帝國開發計劃

> 單位換算：**1 子熙幣 (ZXC) = 1 新台幣 (TWD)**
> 所有設備/材料/研發成本皆以真實半導體產業價格為基準等比縮放。
> 越後期，成本與收入都是指數級成長，但門檻也極高。
>
> 🚫 **半導體系統與賭場完全獨立**，晶片不影響任何博弈機制。
> 晶片的唯一作用：**組裝電腦 → 加速半導體自身生產**。

---

## 🏢 公司系統總覽

### 公司類型

| 類型 | 狀態 | 說明 |
|------|------|------|
| **AI 公司** | ⏳ 待重構 | 未來以 OpenAI 起源故事為範本，員工/R&D/模型訓練玩法 |
| **半導體公司** | 🎯 **開發中** | 從 1971 手繪晶片到先進封裝的完整科技樹 |

### 核心設計原則

1. **階梯式成本** — 每個階段的設備/研發成本對應真實半導體產業價格
2. **指數級收益** — 越先進的晶片，售價呈指數成長
3. **員工驅動** — 沒有員工無法運作，員工素質決定效率與良率
4. **掛機 + 操作** — 生產是計時器掛機，科技樹/突破是手動操作
5. **晶片閉環** — 生產晶片 → 組裝電腦 → 電腦加速生產 → 生產更先進晶片

---

## 📈 成本與收益曲線

```
階段           設備成本        每片晶片價值      基礎生產時間
────────────────────────────────────────────────────────────
手繪 10μm     500 ZXC         15-50 ZXC          4 小時
手繪 5μm      3,000 ZXC       50-150 ZXC         2 小時
黃光 G-line   50,000 ZXC      200-800 ZXC        45 分鐘
Stepper 1μm   10,000,000 ZXC  50K-200K ZXC      30 分鐘
DUV 248nm     100,000,000 ZXC 500K-2M ZXC       20 分鐘
ArF 193nm     500,000,000 ZXC 2M-10M ZXC        15 分鐘
EUV 13.5nm    5,000,000,000 ZXC 50M-200M ZXC   10 分鐘
先進封裝      另計            晶片價值 x2-5x    另計
```

---

## 🟢 Phase 1：CPU 時代（手繪 → 微米微影）1971-1989

> 玩家從一間破舊工作室起步，用美工刀和紅膠膜手工刻劃電路。

### 製程節點

> 早期無自動化設備，每次生產就是一次「手工曝光」循環。
> 沒有員工時生產時間最長，雇用 fab_worker 可逐步縮短。

| 節點 | 解鎖條件 | 基礎良率 | 基礎產量 | 基礎耗時 | 每 fab_worker 減時 | 晶片產出 |
|------|----------|----------|----------|----------|-------------------|----------|
| `hand_drawn_10um` | 初始自帶 | 23% | 3-8 片 | 4 小時 | -30 min | 子熙-4004 |
| `hand_drawn_5um` | camera_lens Lv.1 | 28% | 2-6 片 | 2 小時 | -15 min | 子熙-8086 |
| `yellow_room_g_line` | 突破瓶頸（10x 子熙-4004 + 5,000 ZXC） | 35% | 2-5 片 | 45 分鐘 | -5 min | 子熙-486 |

### 晶片價值與用途

| 晶片 | 對應真實晶片 | 每片價值 | 組裝用途 |
|------|-------------|----------|----------|
| 子熙-4004 | Intel 4004 (1971) | 15-50 ZXC | 可組裝「初階計算機」 |
| 子熙-8086 | Intel 8086 (1978) | 50-150 ZXC | 可組裝「第二代計算機」 |
| 子熙-486 | Intel 486 (1989) | 200-800 ZXC | 可組裝「工作站」 |

### 電腦組裝（晶片的主要用途）

| 電腦 | 需求晶片 | 效果 | 說明 |
|------|----------|------|------|
| 初階計算機 | 5x 子熙-4004 | 生產時間 -10% | 第一台能輔助計算的機器 |
| 第二代計算機 | 3x 子熙-8086 | 生產時間 -15%，良率 +3% | 更快的計算輔助 |
| 工作站 | 2x 子熙-486 | 生產時間 -20%，良率 +5% | 專業級工程工作站 |

> 每台電腦佔用 1 個機架位，機架位 = factoryTier × 3 + 1。
> 晶片也可直接賣給系統回收，回收價 = 基礎價值 × 0.5。

### 科技樹

| id | 名稱 | 最大等級 | 每級成本 | 每級效果 |
|----|------|----------|----------|----------|
| `blade_quality` | 優化鎢鋼刀片 | Lv.3 | 800 ZXC | 良率 +3% |
| `air_filtration` | 加裝排風扇 | Lv.1 | 1,500 ZXC | 落塵報廢率 -5% |
| `camera_lens` | 改進大相機鏡頭 | Lv.2 | 3,000 ZXC | Lv.1 解鎖 5μm，Lv.2 提升良率 +2% |
| `exposure_accuracy` | 曝光對準精度 | Lv.2 | 2,000 ZXC | 良率 +2%/Lv.（黃光室解鎖） |

### 員工

| 角色 | 基本薪資/tick | 核心影響 |
|------|--------------|----------|
| `fab_worker` 晶圓作業員 | 3 | 每名 +0.5 基礎產量 |
| `process_engineer` 製程工程師 | 5 | 良率 +2%/名（依 productivity 加權） |
| `chip_designer` 晶片設計師 | 6 | 研發速度 +10%/名，突破成本 -5%/名 |
| `research_scientist` 研究科學家 | 8 | 科技升級成本 -8%/名 |

### 公司營運成本（每 tick = 30 秒）

- 員工薪資：所有員工 salary 總和
- 水電租金：base 1 ZXC/tick（隨 factoryTier 增加）
- 材料消耗：每次生產消耗 base 50 ZXC 材料費

### 收益來源

- 晶片回收賣給系統（回收價 = 基礎價值 × 0.5）
- 晶片可掛賣場賣給其他玩家（自由定價）
- 電腦間接提升生產效率 = 更高產出

### 瓶頸突破

當科技樹點滿、晶片庫存足夠時，可進行時代瓶頸突破：

| 突破項目 | 消耗 | 結果 |
|----------|------|------|
| 微處理器架構革新 | 10x 子熙-4004 + 5,000 ZXC | 解鎖 `hand_drawn_5um` |
| 進入黃光時代 | 8x 子熙-8086 + 20,000 ZXC | 解鎖 `yellow_room_g_line` |

---

## 🟡 Phase 2：CPU / GPU 雙線分叉（微米 → DUV 奈米）1990-2020

> 科技樹正式分岔為 CPU 與 GPU 兩條獨立產線，玩家需分配資源雙線營運。

### CPU 產線

| 節點 | 成本 | 良率 | 晶片 | 每片價值 |
|------|------|------|------|----------|
| `i_line_stepper` | 500,000 ZXC | 45% | Pentium | 2K-8K ZXC |
| `duv_248nm` | 10,000,000 ZXC | 55% | Core i7 (Nehalem) | 50K-200K ZXC |
| `finfet_22nm` | 100,000,000 ZXC | 60% | Core i7 (Haswell) | 500K-2M ZXC |
| `duv_14nm` | 500,000,000 ZXC | 65% | AMD Ryzen | 2M-10M ZXC |

### GPU 產線（需 CPU 產線達 i_line 後解鎖）

| 節點 | 成本 | 良率 | 晶片 | 每片價值 |
|------|------|------|------|----------|
| `gpu_raster` | 300,000 ZXC | 40% | GeForce 256 | 5K-20K ZXC |
| `gpu_shader` | 8,000,000 ZXC | 48% | GTX 980 | 100K-500K ZXC |
| `gpu_cuda` | 80,000,000 ZXC | 52% | Tesla V100 | 1M-5M ZXC |
| `gpu_tensor` | 600,000,000 ZXC | 55% | RTX 3090 | 5M-20M ZXC |

### 新科技樹

| 科技 | 分類 | 每級成本 | 效果 |
|------|------|----------|------|
| `stepper_alignment` | CPU | 50,000 ZXC/Lv | 良率 +2%/Lv（Max 5） |
| `cuda_core_arch` | GPU | 100,000 ZXC/Lv | GPU 產量 +10%/Lv（Max 5） |
| `multi_core_design` | CPU | 200,000 ZXC/Lv | CPU 產量 +15%/Lv（Max 3） |
| `hbm_memory` | GPU | 500,000 ZXC/Lv | GPU 良率 +3%/Lv（Max 3） |

### 設備成本（真實價格）

| 設備 | 成本 | 真實參考價格 |
|------|------|-------------|
| I-line Stepper | 500,000 ZXC | ~50 萬 USD (Nikon NSR) |
| DUV 248nm Scanner | 10,000,000 ZXC | ~1,000 萬 USD (ASML PAS 5500) |
| ArF 193nm Immersion | 500,000,000 ZXC | ~5,000 萬 USD (ASML NXT) |
| EUV 13.5nm | 5,000,000,000 ZXC | ~3.5 億 USD (ASML NXE:3600D) |

---

## 🔴 Phase 3：先進封裝車間（Chiplet + CoWoS）2020-2025

> 摩爾定律逼近物理極限，光縮小製程已無法提升效能。玩家必須進入**先進封裝（Advanced Packaging）**時代——將多顆小晶片（Chiplet）異質整合為一顆超級處理器。

### 解鎖條件

- CPU 產線達到 `duv_14nm` 且擁有 **10 片以上 Ryzen** 等級晶片
- 消耗 1,000,000,000 ZXC 建立封裝車間

### 封裝技術

#### 1. AMD Infinity Fabric — Chiplet 拼裝

| 項目 | 需求 | 產出 |
|------|------|------|
| CCD 小晶片 | 8x CPU 計算晶片（duv_14nm 產出） | AMD EPYC 64 核 |
| I/O Die | 1x 成熟製程 I/O 晶片 | |
| Infinity Fabric | 消耗 50,000,000 ZXC 啟動封裝 | |
| **結果** | 封裝良率 60% | **EPYC 伺服器晶片**（價值 50M-200M ZXC） |
| **組裝用途** | 1x EPYC → 組裝「伺服器節點」 | 生產時間 -30%，可並行生產 |

#### 2. NVIDIA CoWoS — 晶圓級封裝

| 項目 | 需求 | 產出 |
|------|------|------|
| GPU Core | 1x 頂級 GPU 晶片（gpu_tensor 產出） | NVIDIA H100 / Blackwell B200 |
| HBM 記憶體 | 4-8x 極難生產的高頻寬記憶體 | |
| 矽中介層 | 1x Silicon Interposer（特殊材料） | |
| CoWoS 封裝 | 消耗 200,000,000 ZXC | |
| **結果** | **基礎封裝良率 40%**（可透過科技提升至 95%） | **H100/Blackwell**（價值 200M-1B ZXC） |
| **組裝用途** | 1x H100 → 組裝「AI 算力櫃」 | 所有生產節點良率 +15% |

### 封裝科技樹

| 科技 | 成本 | 效果 |
|------|------|------|
| `underfill_optimization` | 50M ZXC/Lv（Max 3） | 封裝良率 +10%/Lv |
| `ultrasonic_inspection` | 100M ZXC | 提前檢出缺陷，報廢率 -15% |
| `silicon_interposer` | 200M ZXC | 解鎖 CoWoS-S 大面積封裝 |
| `hybrid_bonding` | 500M ZXC | 解鎖 3D 堆疊，頻寬 x2 |

---

## 📁 檔案架構規劃

```
packages/domain/src/semiconductor/
├── constants.ts              — 節點/科技/晶片/電腦/職業定義
├── employee-gen.ts           — 半導體員工生成（含 traits/synergy）
├── semiconductor-manager.ts  — 核心邏輯（生產/研發/突破/組裝/tick）
└── index.ts                  — re-export

apps/api/src/routes/v1/company.ts  — 新增 semiconductor 路由（production/claim/research/craft/assemble）
apps/web/src/features/company/
├── CompanyView.tsx            — 修改：支援 semiconductor 類型
├── SemiconductorView.tsx      — 新增：半導體儀表板（Fab / R&D / Team / Assembly / Chart 五 tab）
└── useSemiconductor.ts        — 新增：React Query data hook
```

---

## 🛠️ Phase 1 實作範圍

### 包含功能
- [x] 公司創立支援 `semiconductor` 類型（1,000 ZXC）
- [x] CPU 時代三個節點（10μm → 5μm → G-line）
- [x] 四項科技樹（刀片/排風/鏡頭/精度）
- [x] 生產流程（開始 → 等待數小時 → 領取）
- [x] 良率系統（基礎 23% + 科技 + 員工加成）
- [x] 半導體員工招募（4 種角色）
- [x] 瓶頸突破系統（消耗晶片解鎖下一時代）
- [x] 電腦組裝系統（消耗晶片換取生產加成）
- [x] 倉庫庫存管理
- [x] 營運資金存入/提領
- [x] 前端 Fab/R&D/Team/Assembly 四 tab UI

### 不包括（後續階段）
- [ ] GPU 產線及雙線管理（Phase 2）
- [ ] 先進封裝車間與拖拽介面（Phase 3）
- [ ] ECharts 歷史數據折線圖（Phase 2）
- [ ] 晶片玩家交易市場（Phase 2）

---

## ⚖️ 經濟平衡參數（Phase 1）

| 項目 | 數值 |
|------|------|
| 創立成本 | 1,000 ZXC |
| 生產材料費 | 50 ZXC/次 |
| 員工薪資 | 3-8 ZXC/tick |
| 水電租金（作坊） | 1 ZXC/tick |
| 水電租金（黃光室） | 10 ZXC/tick |
| 晶片回收價 | 基礎價值 × 0.5 |
| 破產線 | cash < -5,000 ZXC |
| 基礎生產時間（無員工） | 4 小時（10μm）→ 逐步縮短 |
| **生產時間公式** | `baseDuration - (fabWorkerCount × timeReductionPerWorker)`，最少 30% 原時間 |
| **機架位** | `factoryTier × 3 + 1` |

---

## 🔄 與現有系統關係

| 現有系統 | 處理方式 |
|----------|----------|
| `company_accounts` 表 | 沿用，`company_type` 新增 `semiconductor` |
| `data` JSONB 欄位 | 沿用，semiconductor 資料存入此欄位 |
| AI 公司 | 保留現有系統（待之後重構成 OpenAI 範本玩法） |
| 舊 chip 公司角色/產品 | **全部移除** |
| 員工 trait/synergy 系統 | 沿用並擴充 |
| KV claimSlot 冷卻 | 用於生產冷卻鎖 |
| React Query 30s 輪詢 | 沿用 |
| `api` axios instance | 沿用 |
| 路由 `/app/company` | 沿用 |

---

## 2 奈米才是真競爭，而我的 EUV，才正要開始。
