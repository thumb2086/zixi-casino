import postgres from 'postgres';
// ★ 2026-10-17：這裡原本硬寫了 Neon 的完整 DSN（含密碼），已改��讀 env。
//
//   為什麼：密碼在版控裡就等於公開了，而且已經進了 git 歷史，
//   改檔案不會讓歷史消失 —— 密碼仍然必須輪替。
//
//   用法：
//     set DATABASE_URL=postgres://user:pass@host/db
//     npx tsx apps/api/scripts/check_keys.mjs
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
if (!url) {
  console.error("DATABASE_URL / POSTGRES_URL 未設定。\n" +
    "  這支腳本需要資料庫連線字串，請用環境變數提供，不要再寫回檔案裡。");
  process.exit(1);
}
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
