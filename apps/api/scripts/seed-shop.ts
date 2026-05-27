import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL || process.env.DB_URL || '';

const SHOP_ITEMS = [
  {
    type: 'bundle',
    itemId: 'combo_starter',
    name: '新手上路組合包',
    nameEn: 'Starter Pack',
    description: '內含經典籌碼頭像 + 新手稱號 + 50 ZXC + 經驗加倍(1h)',
    rarity: 'common',
    source: 'shop',
    price: 500,
    isActive: true,
    meta: {
      bundle: [
        { id: 'avatar_chip', qty: 1 },
        { id: 'title_newbie', qty: 1 },
        { id: 'token_50', qty: 1 },
        { id: 'buff_xp_1h', qty: 1 },
      ],
      totalValue: 850,
    },
  },
  {
    type: 'bundle',
    itemId: 'combo_lucky',
    name: '幸運組合包',
    nameEn: 'Lucky Pack',
    description: '內含幸運星稱號 + 250 ZXC + 幸運加成(1h) + 免輸護符(3次)',
    rarity: 'rare',
    source: 'shop',
    price: 1200,
    isActive: true,
    meta: {
      bundle: [
        { id: 'title_lucky', qty: 1 },
        { id: 'token_250', qty: 1 },
        { id: 'buff_luck_1h', qty: 1 },
        { id: 'buff_prevent_loss_3', qty: 1 },
      ],
      totalValue: 1600,
    },
  },
  {
    type: 'bundle',
    itemId: 'combo_xp',
    name: '升級組合包',
    nameEn: 'XP Pack',
    description: '內含 500 ZXC + 經驗加倍(4h) + 幸運加成(2h) + 免輸護符(5次)',
    rarity: 'epic',
    source: 'shop',
    price: 2500,
    isActive: true,
    meta: {
      bundle: [
        { id: 'token_500', qty: 1 },
        { id: 'buff_xp_4h', qty: 1 },
        { id: 'buff_luck_2h', qty: 1 },
        { id: 'buff_prevent_loss_5', qty: 1 },
      ],
      totalValue: 3800,
    },
  },
  {
    type: 'bundle',
    itemId: 'combo_mythic',
    name: '神話降臨組合包',
    nameEn: 'Mythic Descent Pack',
    description: '內含鳳凰頭像 + 賭神稱號 + 5000 ZXC，一次入手神話級收藏！',
    rarity: 'mythic',
    source: 'shop',
    price: 15000,
    isActive: true,
    meta: {
      bundle: [
        { id: 'avatar_phoenix', qty: 1 },
        { id: 'title_god', qty: 1 },
        { id: 'token_5000', qty: 1 },
      ],
      totalValue: 22000,
    },
  },
  {
    type: 'bundle',
    itemId: 'combo_celebration_v1_0_10',
    name: '至尊慶典組合包',
    nameEn: 'Supreme Celebration Pack',
    description: 'V1.0.10 慶典限定！至尊皇冠頭像 + 開國元老稱號 + 1億 ZXC + 2500萬 ZXC + 經驗加倍24h + 強運加持2h + 星塵瓶 + 免輸護符10次',
    rarity: 'mythic',
    source: 'shop',
    price: 1_280_000_000,
    isActive: true,
    meta: {
      bundle: [
        { id: 'avatar_crown_supreme', qty: 1 },
        { id: 'title_founding_elder', qty: 1 },
        { id: 'token_100000000', qty: 1 },
        { id: 'token_25000000', qty: 1 },
        { id: 'buff_xp_24h', qty: 1 },
        { id: 'buff_luck_2h', qty: 1 },
        { id: 'collectible_star', qty: 1 },
        { id: 'buff_prevent_loss_10', qty: 1 },
      ],
      totalValue: 130_012_500,
    },
  },
];

async function main() {
  const url = DATABASE_URL;
  if (!url) {
    console.error('❌ 請設定 DATABASE_URL 環境變數');
    console.error('   範例: DATABASE_URL=postgres://user:pass@host:5432/db npx tsx apps/api/scripts/seed-shop.ts');
    process.exit(1);
  }
  console.log('🌱 Seeding shop items...');
  const sql = postgres(url, { ssl: 'require', max: 1 });
  // Remove old broken bundle (spending ZXC to buy ZXC)
  await sql`DELETE FROM reward_catalog WHERE item_id = 'combo_zxc_v1'`;
  console.log('  🗑️ Removed old combo_zxc_v1');
  for (const item of SHOP_ITEMS) {
    try {
      await sql`
        INSERT INTO reward_catalog (item_id, type, name, rarity, source, price, is_active, meta)
        VALUES (${item.itemId}, ${item.type}, ${item.name}, ${item.rarity}, ${item.source}, ${item.price}, ${item.isActive}, ${JSON.stringify(item.meta)})
        ON CONFLICT (item_id) DO UPDATE SET type = EXCLUDED.type, name = EXCLUDED.name, rarity = EXCLUDED.rarity, price = EXCLUDED.price, meta = EXCLUDED.meta, updated_at = NOW()
      `;
      console.log(`  ✅ ${item.itemId} — ${item.name}`);
    } catch (err: any) {
      console.error(`  ❌ ${item.itemId} — ${err.message}`);
    }
  }
  await sql.end();
  console.log('✅ Seed complete!');
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
