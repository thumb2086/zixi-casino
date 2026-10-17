import postgres from 'postgres';

// ★ 2026-10-17：原本這裡有硬寫的 Neon DSN 當 fallback，已拿掉。
//
//   env 拿不到就明確失敗 —— 寧���腳本跑不起來，
//   也不要讓人為了圖方便又把 DSN 貼回來（上次就是這樣進去的）。
const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
if (!url) {
  console.error("DATABASE_URL / POSTGRES_URL 未設定。\n" +
    "  用法：DATABASE_URL=postgres://user:pass@host/db npx tsx apps/api/scripts/migrate-kv-case.ts");
  process.exit(1);
}
const sql = postgres(url, { ssl: 'require', max: 1 });

async function main() {
  const rows = await sql`
    SELECT key, value FROM kv_store 
    WHERE key LIKE 'active_avatar:%' OR key LIKE 'active_title:%'
  `;

  let fixed = 0;
  for (const row of rows) {
    const parts = row.key.split(':');
    const addr = parts[parts.length - 1];
    const lowerAddr = addr.toLowerCase();
    if (addr !== lowerAddr) {
      const lowerKey = parts.slice(0, -1).join(':') + ':' + lowerAddr;
      // Insert lowercased version, delete old
      await sql`INSERT INTO kv_store (key, value, updated_at)
                VALUES (${lowerKey}, ${row.value}, NOW())
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
      await sql`DELETE FROM kv_store WHERE key = ${row.key}`;
      console.log(`  Fixed: ${row.key} -> ${lowerKey}`);
      fixed++;
    }
  }
  console.log(`Done: ${fixed} keys fixed`);
  await sql.end();
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
