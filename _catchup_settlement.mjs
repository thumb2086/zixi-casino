/**
 * 補發歷史清算上鏈轉帳
 * Usage: node _catchup_settlement.mjs
 * Env needs: POSTGRES_URL_NON_POOLING, RPC_URL(or PRC), ADMIN_PRIVATE_KEY
 */

import { randomUUID } from 'node:crypto';

// Resolve pnpm virtual store path (this script lives at repo root)
const scriptDir = new URL('.', import.meta.url).pathname.replace(/\/$/, '');
const pnpmStore = `${scriptDir}/node_modules/.pnpm`;

const { neon } = await import(`${pnpmStore}/@neondatabase+serverless@0.10.4/node_modules/@neondatabase/serverless/index.mjs`);
const { ethers } = await import(`${pnpmStore}/ethers@6.16.0/node_modules/ethers/lib.esm/index.js`);

// ── Env ──
const DB_URL = process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const RPC_URL = process.env.RPC_URL || process.env.PRC;
const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT = process.env.ZXC_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || '0xe3d9af5f15857cb01e0614fa281fcc3256f62050';

if (!DB_URL || !RPC_URL || !ADMIN_KEY) {
  console.error('Missing env vars.');
  process.exit(1);
}

const sql = neon(DB_URL);

// 1. Find unsettled entries
console.log('Querying unsettled entries...');
const entries = await sql`
  SELECT le.* FROM wallet_ledger_entries le
  WHERE le.type = 'market_settlement'
    AND CAST(le.amount AS numeric) > 0
    AND NOT EXISTS (
      SELECT 1 FROM tx_intents ti
      WHERE ti.user_id = le.user_id
        AND ti.address = le.address
        AND ti.status = 'confirmed'
        AND ti.meta->>'source' LIKE 'market_liquidation%'
        AND ABS(CAST(ti.amount AS numeric) - CAST(le.amount AS numeric)) < 1
    )
  ORDER BY le.created_at ASC
`;

console.log(`Found ${entries.length} unsettled entries`);

if (entries.length === 0) {
  console.log('Nothing to replay. Exiting.');
  process.exit(0);
}

// 2. Send transfers
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(ADMIN_KEY.startsWith('0x') ? ADMIN_KEY : `0x${ADMIN_KEY}`, provider);
const token = new ethers.Contract(CONTRACT, [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
], wallet);

const decimals = await token.decimals();
console.log(`Token decimals: ${decimals}`);

let success = 0, fail = 0;

for (const entry of entries) {
  const amountNum = Math.abs(Number(entry.amount));
  const amountWei = ethers.parseUnits(String(amountNum), decimals);
  try {
    console.log(`  Sending ${amountNum.toLocaleString()} ZXC to ${entry.address.slice(0, 10)}...`);
    const tx = await token.transfer(entry.address, amountWei, { gasLimit: 100000 });
    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`    ✅ confirmed: ${receipt.hash}`);
      await sql`
        INSERT INTO tx_intents (id, user_id, address, token, type, amount, status, tx_hash, meta, created_at, updated_at)
        VALUES (${randomUUID()}, ${entry.user_id}, ${entry.address}, 'ZXC', 'admin_credit',
                ${String(amountNum)}, 'confirmed', ${receipt.hash},
                ${JSON.stringify({ source: 'market_liquidation_catchup', originalLedgerId: entry.id })},
                NOW(), NOW())
      `;
      success++;
    } else {
      console.log(`    ❌ reverted`);
      fail++;
    }
  } catch (e) {
    console.log(`    ❌ error: ${e.message}`);
    fail++;
  }
}

console.log(`\nDone: ${success} succeeded, ${fail} failed`);
