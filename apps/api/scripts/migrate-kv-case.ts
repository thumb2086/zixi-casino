import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || 'postgresql://neondb_owner:npg_4hHl1AMjTier@ep-quiet-tooth-amze0a44-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require';
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
