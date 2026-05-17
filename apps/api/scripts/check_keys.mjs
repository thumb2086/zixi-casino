import postgres from 'postgres';
const url = 'postgresql://neondb_owner:npg_4hHl1AMjTier@ep-quiet-tooth-amze0a44-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
const sql = postgres(url, { ssl: 'require', max: 1 });
const profiles = await sql`SELECT address, selected_avatar_id, selected_title_id FROM user_profiles WHERE selected_avatar_id IS NOT NULL OR selected_title_id IS NOT NULL`;
let count = 0;
for (const p of profiles) {
  const addr = p.address.toLowerCase();
  if (p.selected_avatar_id) {
    await sql`INSERT INTO kv_store (key, value, updated_at) VALUES (${'active_avatar:' + addr}, ${JSON.stringify(p.selected_avatar_id)}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    count++;
  }
  if (p.selected_title_id) {
    await sql`INSERT INTO kv_store (key, value, updated_at) VALUES (${'active_title:' + addr}, ${JSON.stringify(p.selected_title_id)}, NOW()) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
    count++;
  }
  console.log(`  ${addr}: avatar=${p.selected_avatar_id}, title=${p.selected_title_id}`);
}
console.log(`Backfilled ${count} KV entries`);
await sql.end();
