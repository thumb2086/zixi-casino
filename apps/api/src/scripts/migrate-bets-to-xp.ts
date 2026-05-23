// apps/api/src/scripts/migrate-bets-to-xp.ts
// Run: npx tsx apps/api/src/scripts/migrate-bets-to-xp.ts
// Converts total_bets.amount to user_profiles.xp (1 ZXC bet = 1 XP)

import { requireDb } from "@repo/infrastructure/db/index.js";
import { sql } from "drizzle-orm";
import { levelForXp } from "@repo/domain";

async function migrate() {
  const db = await requireDb();
  console.log("Fetching total_bets (all period)...");

  const rows = await db.execute(sql`
    SELECT address, amount FROM total_bets
    WHERE period_type = 'all' AND period_id = '' AND amount > 0
    ORDER BY amount DESC
  `);

  const items: { address: string; amount: number }[] = [];
  for (let i = 0; i < (rows as any).length; i++) {
    items.push({ address: (rows as any)[i].address, amount: Number((rows as any)[i].amount || 0) });
  }
  console.log(`Found ${items.length} users with betting history`);

  let updated = 0;
  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const addr = item.address.toLowerCase();
    const xp = Math.floor(item.amount); // 1 ZXC = 1 XP
    const level = levelForXp(xp);

    // Try update first
    const result = await db.execute(sql`
      UPDATE user_profiles
      SET xp = GREATEST(xp, ${xp}),
          level = CASE WHEN xp < ${xp} THEN ${level} ELSE level END,
          updated_at = NOW()
      WHERE address = ${addr}
    `);

    if ((result as any).count === 0 || (result as any).affectedRows === 0) {
      // No row exists — try to find user_id from users table
      const userRow = await db.execute(sql`
        SELECT id FROM users WHERE address = ${addr} LIMIT 1
      `);
      const userId = (userRow as any)[0]?.id;
      if (userId) {
        await db.execute(sql`
          INSERT INTO user_profiles (user_id, address, xp, level, created_at, updated_at)
          VALUES (${userId}, ${addr}, ${xp}, ${level}, NOW(), NOW())
          ON CONFLICT (user_id) DO UPDATE
          SET xp = GREATEST(user_profiles.xp, ${xp}),
              level = CASE WHEN user_profiles.xp < ${xp} THEN ${level} ELSE user_profiles.level END,
              updated_at = NOW()
        `);
        created++;
      } else {
        skipped++;
      }
    } else {
      updated++;
    }

    if ((updated + created) % 50 === 0) {
      console.log(`Progress: ${updated} updated, ${created} created, ${skipped} skipped`);
    }
  }

  console.log(`Done! Updated: ${updated}, Created: ${created}, Skipped (no user): ${skipped}`);
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
