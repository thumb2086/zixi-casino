// apps/api/scripts/scan-collectible-dupes.ts
// Scan all user profiles for duplicate collectibles and compensate ZXC.
// Usage: DATABASE_URL=postgres://... npx tsx apps/api/scripts/scan-collectible-dupes.ts

import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_URL || '';
const COMPENSATION_PER_DUPE = 200;
const COLLECTIBLE_IDS = new Set([
  'collectible_crystal', 'collectible_moon', 'collectible_coin',
  'collectible_feather', 'collectible_map',
  'collectible_neon', 'collectible_dragon_eye', 'collectible_ring',
  'collectible_hourglass', 'collectible_compass',
  'collectible_trophy', 'collectible_skull', 'collectible_crown', 'collectible_orb',
  'collectible_lamp', 'collectible_mask',
  'collectible_star', 'collectible_heart', 'collectible_egg', 'collectible_anchor',
]);

async function main() {
  const url = DATABASE_URL;
  if (!url) {
    console.error('❌ 請設定 DATABASE_URL 環境變數');
    process.exit(1);
  }
  const sql = postgres(url, { ssl: 'require', max: 1 });

  const profiles = await sql`SELECT user_id, address, inventory FROM user_profiles`;
  console.log(`📊 找到 ${profiles.length} 個使用者設定檔`);

  let totalComp = 0;
  let totalUsers = 0;

  for (const row of profiles) {
    const inv = typeof row.inventory === 'string' ? JSON.parse(row.inventory) : (row.inventory || {});
    let userComp = 0;
    const dupes: string[] = [];
    const newInv: Record<string, number> = { ...inv };

    for (const [itemId, qty] of Object.entries(inv)) {
      if (COLLECTIBLE_IDS.has(itemId) && typeof qty === 'number' && qty > 1) {
        userComp += qty * COMPENSATION_PER_DUPE;
        dupes.push(`${itemId} x${qty}`);
        newInv[itemId] = 1;
      }
    }

    if (userComp > 0) {
      totalComp += userComp;
      totalUsers++;
      const addr = (row.address || '').toLowerCase();

      // Fix inventory: keep only 1 per collectible
      await sql`UPDATE user_profiles SET inventory = ${JSON.stringify(newInv)}::jsonb WHERE user_id = ${row.user_id}`;

      // Credit ZXC via wallet_accounts
      const existing = await sql`SELECT balance FROM wallet_accounts WHERE address = ${addr} AND token = 'zhixi'`;
      const currentBal = existing.length ? parseFloat(existing[0].balance || '0') : 0;
      const newBal = (currentBal + userComp).toFixed(4);
      if (existing.length) {
        await sql`UPDATE wallet_accounts SET balance = ${newBal} WHERE address = ${addr} AND token = 'zhixi'`;
      } else {
        await sql`INSERT INTO wallet_accounts (user_id, address, token, balance) VALUES (${row.user_id}, ${addr}, 'zhixi', ${newBal})`;
      }

      console.log(`  ✅ ${addr}: +${userComp} ZXC（${dupes.join(', ')}）`);
    }
  }

  await sql.end();
  console.log(`\n✅ 掃描完成！共補償 ${totalUsers} 個使用者，總計 ${totalComp} ZXC`);
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 掃描失敗:', err);
  process.exit(1);
});
