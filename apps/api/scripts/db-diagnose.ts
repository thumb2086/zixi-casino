// apps/api/scripts/db-diagnose.ts
// 檢查 Neon 資料庫中所有預期表格是否存在
// Usage: DATABASE_URL=postgres://... npx tsx apps/api/scripts/db-diagnose.ts

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_URL || '';

const EXPECTED_TABLES = [
  'users', 'custody_accounts', 'sessions', 'user_profiles',
  'wallet_accounts', 'wallet_ledger_entries',
  'tx_intents', 'tx_attempts', 'tx_receipts',
  'market_accounts', 'market_trades',
  'ops_events', 'announcements', 'total_bets', 'leaderboard_kings', 'kv_store',
  'reward_submissions', 'reward_catalog', 'reward_campaigns', 'reward_grants',
];

async function main() {
  const url = DATABASE_URL;
  if (!url) {
    console.error('❌ 請設定 DATABASE_URL 環境變數');
    process.exit(1);
  }
  const sql = postgres(url, { ssl: 'require', max: 1 });

  console.log('🔍 掃描資料庫表格狀態...\n');

  for (const table of EXPECTED_TABLES) {
    const [row] = await sql`
      SELECT to_regclass(${('public.' + table)}) IS NOT NULL AS "exists"
    `;
    const exists = row?.exists === true;
    console.log(`  ${exists ? '✅' : '❌'} ${table}${exists ? '' : '  ← 缺少！'}`);
  }

  // 檢查 reward_campaigns 的欄位（如果表存在）
  const [campaignsExists] = await sql`
    SELECT to_regclass('public.reward_campaigns') IS NOT NULL AS "exists"
  `;
  if (campaignsExists?.exists) {
    console.log('\n📋 reward_campaigns 欄位：');
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reward_campaigns'
      ORDER BY ordinal_position
    `;
    for (const c of cols) {
      console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    }
  } else {
    console.log('\n📋 reward_campaigns 表不存在，無法檢查欄位');
  }

  // 檢查 reward_catalog 的欄位
  const [catalogExists] = await sql`
    SELECT to_regclass('public.reward_catalog') IS NOT NULL AS "exists"
  `;
  if (catalogExists?.exists) {
    console.log('\n📋 reward_catalog 欄位：');
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reward_catalog'
      ORDER BY ordinal_position
    `;
    for (const c of cols) {
      console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    }
  } else {
    console.log('\n📋 reward_catalog 表不存在，無法檢查欄位');
  }

  // 檢查 reward_grants 的欄位
  const [grantsExists] = await sql`
    SELECT to_regclass('public.reward_grants') IS NOT NULL AS "exists"
  `;
  if (grantsExists?.exists) {
    console.log('\n📋 reward_grants 欄位：');
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'reward_grants'
      ORDER BY ordinal_position
    `;
    for (const c of cols) {
      console.log(`  ${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
    }
  } else {
    console.log('\n📋 reward_grants 表不存在，無法檢查欄位');
  }

  await sql.end();
  console.log('\n✅ 診斷完成');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 診斷失敗:', err);
  process.exit(1);
});
