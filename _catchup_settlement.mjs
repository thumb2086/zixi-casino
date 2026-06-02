/**
 * 補發歷史清算上鏈轉帳
 * 找出 wallet_ledger_entries 中 type='market_settlement' 且 amount>0
 * 但沒有對應 confirmed TxIntent 的記錄，逐筆觸發 adminTransfer
 *
 * 用法: set DATABASE_URL=... && node _catchup_settlement.mjs
 */
import { randomUUID } from 'crypto';
import pkg from './node_modules/.pnpm/@neondatabase+serverless@0.10.4/node_modules/@neondatabase/serverless/index.js';
const { neon } = pkg;

const sql = neon(process.env.DATABASE_URL);
const RPC_URL = process.env.RPC_URL;
const ADMIN_KEY = process.env.ADMIN_PRIVATE_KEY;
const CONTRACT = process.env.ZHIXI_CONTRACT; // ZXC contract address
const TREASURY = process.env.TREASURY_ADDRESS;

if (!RPC_URL || !ADMIN_KEY || !CONTRACT || !TREASURY) {
  console.error('Missing env: RPC_URL, ADMIN_PRIVATE_KEY, ZHIXI_CONTRACT, TREASURY_ADDRESS');
  process.exit(1);
}

// 1. Find market_settlement entries without confirmed TxIntents
const entries = await sql`
  SELECT le.* FROM wallet_ledger_entries le
  WHERE le.type = 'market_settlement'
  AND CAST(le.amount AS numeric) > 0
  AND NOT EXISTS (
    SELECT 1 FROM tx_intents ti
    WHERE ti.address = le.address
    AND ti.status = 'confirmed'
    AND ti.meta->>'source' = 'market_liquidation'
    AND ABS(CAST(ti.amount AS numeric) - CAST(le.amount AS numeric)) < 1
  )
  ORDER BY le.created_at ASC
`;

console.log(`Found ${entries.length} unsettled market settlements`);

if (entries.length === 0) {
  console.log('Nothing to replay. Exiting.');
  process.exit(0);
}

// 2. For each entry, fire adminTransfer
import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(ADMIN_KEY, provider);
const token = new ethers.Contract(CONTRACT, [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
], wallet);

const decimals = await token.decimals();
let success = 0, fail = 0;

for (const entry of entries) {
  const amountWei = ethers.parseUnits(String(Math.abs(Number(entry.amount))), decimals);
  try {
    console.log(`  Transferring ${entry.amount} ZXC to ${entry.address}...`);
    const tx = await token.transfer(entry.address, amountWei);
    const receipt = await tx.wait();
    if (receipt.status === 1) {
      console.log(`    ✅ confirmed tx: ${receipt.hash}`);
      // Record TxIntent
      await sql`
        INSERT INTO tx_intents (id, user_id, address, token, type, amount, status, tx_hash, meta, created_at, updated_at)
        VALUES (${randomUUID()}, ${entry.user_id}, ${entry.address}, 'ZXC', 'admin_credit', ${String(Math.abs(Number(entry.amount)))}, 'confirmed', ${receipt.hash}, ${JSON.stringify({ source: 'market_liquidation_catchup', originalLedgerId: entry.id })}, NOW(), NOW())
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
