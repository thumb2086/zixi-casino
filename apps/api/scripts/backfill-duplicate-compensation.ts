import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_URL || '';

const COMPENSATION: Record<string, number> = {
  avatar: 500,
  title: 300,
};

async function main() {
  const url = DATABASE_URL;
  if (!url) {
    console.error('❌ 請設定 DATABASE_URL');
    process.exit(1);
  }

  const sql = postgres(url, { ssl: 'require', max: 1 });

  const users = await sql`SELECT user_id, inventory, owned_avatars, owned_titles FROM user_profiles`;
  console.log(`📊 共 ${users.length} 位使用者`);

  let totalComp = 0;
  let totalUsers = 0;

  for (const user of users) {
    // Columns are jsonb but might be stored as text — postgres.js won't auto-parse strings
    const invRaw = user.inventory;
    const ownedAvatarsRaw = user.owned_avatars;
    const ownedTitlesRaw = user.owned_titles;

    const inv: Record<string, number> = typeof invRaw === 'string' ? JSON.parse(invRaw) : (invRaw || {});
    const ownedAvatars: string[] = typeof ownedAvatarsRaw === 'string' ? JSON.parse(ownedAvatarsRaw) : (ownedAvatarsRaw || []);
    const ownedTitles: string[] = typeof ownedTitlesRaw === 'string' ? JSON.parse(ownedTitlesRaw) : (ownedTitlesRaw || []);

    let userComp = 0;
    const updatedInv = { ...inv };

    // Coerce numeric string values to numbers
    for (const key of Object.keys(updatedInv)) {
      const v = updatedInv[key];
      updatedInv[key] = typeof v === 'string' ? Number(v) : v;
    }
    const parsedInv: Record<string, number> = {};
    for (const [k, v] of Object.entries(updatedInv)) {
      parsedInv[k] = typeof v === 'string' ? Number(v) : (v as number);
    }

    for (const [itemId, qty] of Object.entries(parsedInv)) {
      if (qty <= 1) continue;

      if (ownedAvatars.includes(itemId)) {
        const duplicates = qty - 1;
        const comp = duplicates * (COMPENSATION.avatar || 500);
        userComp += comp;
        updatedInv[itemId] = 1;
        const name = (await sql`SELECT name FROM reward_catalog WHERE item_id = ${itemId}`.catch(() => []));
        const display = name.length > 0 ? name[0].name : itemId;
        console.log(`  🗑️ ${display} 剩餘 ${duplicates} 重複 → 補償 ${comp} ZXC`);
      }

      // Any item in inventory with qty > 1 that's already in ownedTitles is a duplicate title
      if (ownedTitles.includes(itemId)) {
        const duplicates = qty - 1;
        const comp = duplicates * (COMPENSATION.title || 300);
        userComp += comp;
        updatedInv[itemId] = 1;
        const name = (await sql`SELECT name FROM reward_catalog WHERE item_id = ${itemId}`.catch(() => []));
        const display = name.length > 0 ? name[0].name : itemId;
        console.log(`  🗑️ ${display} 剩餘 ${duplicates} 重複 → 補償 ${comp} ZXC`);
      }
    }

    if (userComp > 0) {
      totalComp += userComp;
      totalUsers++;
      const newInv = JSON.stringify(updatedInv);
      await sql`UPDATE user_profiles SET inventory = ${newInv}::jsonb WHERE user_id = ${user.user_id}`;

      const userAddr = await sql`SELECT address FROM users WHERE id = ${user.user_id}`;
      if (userAddr.length > 0) {
        const addr = userAddr[0].address as string;
        const bal = await sql`SELECT balance FROM wallet_accounts WHERE address = ${addr} AND token = 'zhixi'`;
        const currentBal = bal.length > 0 ? Number(bal[0].balance) : 0;
        const newBal = String(currentBal + userComp);
        await sql`INSERT INTO wallet_accounts (user_id, address, token, balance, updated_at)
          VALUES (${user.user_id}, ${addr}, 'zhixi', ${newBal}, NOW())
          ON CONFLICT (address, token) DO UPDATE SET balance = ${newBal}, updated_at = NOW()`;
        console.log(`  💰 ${addr} +${userComp} ZXC (餘額 ${newBal})`);
      }
    }
  }

  console.log(`\n✅ 完成！共 ${totalUsers} 人受影響，總補償 ${totalComp} ZXC`);

  await sql.end();
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ 失敗:', err);
  process.exit(1);
});
