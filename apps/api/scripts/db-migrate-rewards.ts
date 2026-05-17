// apps/api/scripts/db-migrate-rewards.ts
// 遷移 reward_campaigns、reward_grants 表以符合 Drizzle schema
// Usage: DATABASE_URL=postgres://... npx tsx apps/api/scripts/db-migrate-rewards.ts

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_URL || '';

async function main() {
  const url = DATABASE_URL;
  if (!url) {
    console.error('❌ 請設定 DATABASE_URL 環境變數');
    process.exit(1);
  }
  const sql = postgres(url, { ssl: 'require', max: 1 });

  console.log('🔧 開始資料表遷移...\n');

  // ─── 1. 建立 reward_grants ───────────────────────────────────────────────
  console.log('📦 reward_grants');
  await sql`
    CREATE TABLE IF NOT EXISTS reward_grants (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      address TEXT NOT NULL,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      source TEXT NOT NULL,
      campaign_id TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `;
  console.log('  ✅ 已建立');

  // ─── 2. 遷移 reward_campaigns ────────────────────────────────────────────
  console.log('\n📦 reward_campaigns');

  // 檢查是否已有 campaign_id 欄位
  const [hasCampaignId] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'campaign_id'
  `;

  if (!hasCampaignId) {
    // 加入 campaign_id（用現有 id 的值填入）
    await sql`ALTER TABLE reward_campaigns ADD COLUMN campaign_id TEXT`;
    await sql`UPDATE reward_campaigns SET campaign_id = id WHERE campaign_id IS NULL`;
    await sql`ALTER TABLE reward_campaigns ALTER COLUMN campaign_id SET NOT NULL`;
    // 建立唯一索引
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS reward_campaigns_campaign_id_idx ON reward_campaigns (campaign_id)`;
    console.log('  ✅ 加入 campaign_id（從 id 複製）');
  } else {
    console.log('  ⏭️ campaign_id 已存在');
  }

  // 加入 max_claims_per_user（取代 claim_limit_per_user）
  const [hasMaxClaims] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'max_claims_per_user'
  `;
  const [hasClaimLimit] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'claim_limit_per_user'
  `;

  if (!hasMaxClaims) {
    if (hasClaimLimit) {
      await sql`ALTER TABLE reward_campaigns RENAME COLUMN claim_limit_per_user TO max_claims_per_user`;
      console.log('  ✅ claim_limit_per_user → max_claims_per_user');
    } else {
      await sql`ALTER TABLE reward_campaigns ADD COLUMN max_claims_per_user INTEGER DEFAULT 1`;
      console.log('  ✅ 新增 max_claims_per_user');
    }
  } else {
    console.log('  ⏭️ max_claims_per_user 已存在');
  }
  // 如果舊欄位還在但已改名，刪除舊欄位（安全起見）
  if (hasClaimLimit && !hasMaxClaims) {
    // 已改名，不需要額外操作
  } else if (hasClaimLimit && hasMaxClaims) {
    // 兩個欄位都在，刪除舊的
    await sql`ALTER TABLE reward_campaigns DROP COLUMN IF EXISTS claim_limit_per_user`;
    console.log('  🗑️ 移除了舊欄位 claim_limit_per_user');
  }

  // 加入 required_level（取代 min_vip_level）
  const [hasRequiredLevel] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'required_level'
  `;
  const [hasMinVip] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'min_vip_level'
  `;

  if (!hasRequiredLevel) {
    if (hasMinVip) {
      await sql`ALTER TABLE reward_campaigns RENAME COLUMN min_vip_level TO required_level`;
      console.log('  ✅ min_vip_level → required_level');
    } else {
      await sql`ALTER TABLE reward_campaigns ADD COLUMN required_level TEXT`;
      console.log('  ✅ 新增 required_level');
    }
  } else {
    console.log('  ⏭️ required_level 已存在');
  }
  if (hasMinVip && hasRequiredLevel) {
    await sql`ALTER TABLE reward_campaigns DROP COLUMN IF EXISTS min_vip_level`;
    console.log('  🗑️ 移除了舊欄位 min_vip_level');
  }

  // 加入 max_claims_total
  const [hasMaxTotal] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'max_claims_total'
  `;
  if (!hasMaxTotal) {
    await sql`ALTER TABLE reward_campaigns ADD COLUMN max_claims_total INTEGER`;
    console.log('  ✅ 新增 max_claims_total');
  }

  // 加入 created_by
  const [hasCreatedBy] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'created_by'
  `;
  if (!hasCreatedBy) {
    await sql`ALTER TABLE reward_campaigns ADD COLUMN created_by TEXT`;
    console.log('  ✅ 新增 created_by');
  }

  // 加入 created_at / updated_at
  const [hasCreatedAt] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'created_at'
  `;
  const [hasUpdatedAt] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'updated_at'
  `;
  if (!hasCreatedAt) {
    await sql`ALTER TABLE reward_campaigns ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT NOW()`;
    console.log('  ✅ 新增 created_at');
  }
  if (!hasUpdatedAt) {
    await sql`ALTER TABLE reward_campaigns ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT NOW()`;
    console.log('  ✅ 新增 updated_at');
  }

  // 移除 raw 欄位（schema 沒有這個）
  const [hasRaw] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'raw'
  `;
  if (hasRaw) {
    await sql`ALTER TABLE reward_campaigns DROP COLUMN IF EXISTS raw`;
    console.log('  🗑️ 移除了舊欄位 raw');
  }

  // 將 id 改為 UUID 類型（如果目前是 text 且有 UUID 格式的資料）
  const [idDataType] = await sql`
    SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'id'
  `;
  console.log(`  ℹ️  id 欄位類型：${idDataType?.data_type || 'unknown'}`);

  // ─── 3. 最終檢查 ──────────────────────────────────────────────────────────
  console.log('\n🔍 最終檢查...');
  const checks = [
    ['reward_grants', 'reward_grants'],
    ['reward_campaigns.campaign_id', `SELECT to_regclass('public.reward_campaigns') IS NOT NULL AS "e"`],
  ];
  const [grantsCheck] = await sql`SELECT to_regclass('public.reward_grants') IS NOT NULL AS "ok"`;
  console.log(`  ${grantsCheck?.ok ? '✅' : '❌'} reward_grants`);
  
  // 確認 campaign_id 存在
  const [campaignIdCheck] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'campaign_id'
  `;
  console.log(`  ${campaignIdCheck ? '✅' : '❌'} reward_campaigns.campaign_id`);
  
  const [maxClaimsCheck] = await sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'reward_campaigns' AND column_name = 'max_claims_per_user'
  `;
  console.log(`  ${maxClaimsCheck ? '✅' : '❌'} reward_campaigns.max_claims_per_user`);

  await sql.end();
  console.log('\n✅ 遷移完成！');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 遷移失敗:', err);
  process.exit(1);
});
