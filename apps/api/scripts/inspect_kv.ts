import postgres from 'postgres';
import { kv } from '@repo/infrastructure';
import { CHEST_CONFIGS, type ChestType } from '@repo/shared';

const url = process.env.DATABASE_URL || 'postgresql://neondb_owner:REDACTED@ep-quiet-tooth-amze0a44-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(url, { ssl: 'require', max: 1 });

// 1. Cleanup test entry
await kv.del('test_fix:' + Date.now());

// 2. Backfill chest_meta for all users with user_profiles
const profiles = await sql`SELECT up.user_id, u.address FROM user_profiles up JOIN users u ON u.id = up.user_id`;
let count = 0;
for (const p of profiles) {
  const existing = await kv.get<any>(`chest_meta:${p.user_id}`);
  if (!existing) {
    const defaults: Record<ChestType, number> = { common: 0, rare: 0, epic: 0, legendary: 0, mythic: 0, oracle: 0 };
    await kv.set(`chest_meta:${p.user_id}`, { chestPity: defaults, lastFreeChestAt: null });
    console.log(`Created chest_meta for user ${p.user_id} (${p.address})`);
    count++;
  }
}
console.log(`Created ${count} chest_meta entries`);

// 3. Also backfill active_avatar/title for any user_profiles that have them
const withCosmetics = await sql`SELECT up.user_id, u.address, up.selected_avatar_id, up.selected_title_id FROM user_profiles up JOIN users u ON u.id = up.user_id WHERE up.selected_avatar_id IS NOT NULL OR up.selected_title_id IS NOT NULL`;
let cosCount = 0;
for (const p of withCosmetics) {
  const addr = p.address.toLowerCase();
  if (p.selected_avatar_id) {
    const key = `active_avatar:${addr}`;
    if (!(await kv.get(key))) {
      await kv.set(key, p.selected_avatar_id);
      cosCount++;
    }
  }
  if (p.selected_title_id) {
    const key = `active_title:${addr}`;
    if (!(await kv.get(key))) {
      await kv.set(key, p.selected_title_id);
      cosCount++;
    }
  }
}
console.log(`Created ${cosCount} cosmetics KV entries`);

await sql.end();
