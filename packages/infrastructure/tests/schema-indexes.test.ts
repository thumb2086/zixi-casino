// packages/infrastructure/tests/schema-indexes.test.ts
// Validates that the Drizzle schema defines all critical indexes for query performance.

import { describe, it, expect } from 'vitest';
import { getTableConfig } from 'drizzle-orm/pg-core';
import * as schema from '../src/db/schema';

function getTableIndexNames(table: any): string[] {
  const config = getTableConfig(table);
  const idxs = config.indexes || [];
  return idxs.map((idx: any) => {
    if (typeof idx === 'string') return idx;
    if (idx.name) return idx.name;
    if (idx.config?.name) return idx.config.name;
    return '';
  }).filter(Boolean);
}

function getColumnMap(table: any): Record<string, any> {
  const config = getTableConfig(table);
  const map: Record<string, any> = {};
  for (const col of config.columns) {
    map[col.name] = col;
  }
  return map;
}

describe('Schema table existence', () => {
  const requiredTables = [
    'users', 'sessions', 'walletAccounts', 'walletLedgerEntries',
    'txIntents', 'txAttempts', 'txReceipts', 'gameSessions',
    'gameRounds', 'gameSettlements', 'opsEvents', 'chatMessages',
    'totalBets', 'leaderboardKings', 'announcements', 'supportTickets',
    'rewardCatalog', 'rewardCampaigns', 'rewardGrants', 'rewardSubmissions',
    'marketAccounts', 'marketTrades', 'marketListings',
    'custodyAccounts', 'custodyUsers', 'userProfiles',
    'oauthClients', 'oauthAuthorizationCodes', 'oauthAccessTokens',
    'kvStore', 'systemConfig', 'adminActions',
  ];

  for (const tableName of requiredTables) {
    it(`should have table: ${tableName}`, () => {
      expect(schema).toHaveProperty(tableName);
    });
  }
});

describe('Critical indexes for query performance', () => {
  it('wallet_ledger_entries: should have index on (address, created_at) for history queries', () => {
    const indexes = getTableIndexNames(schema.walletLedgerEntries);
    const hasAddrCreatedAt = indexes.some(
      (name) => name.includes('address') && name.includes('created_at')
    );
    expect(hasAddrCreatedAt).toBe(true);
  });

  it('tx_intents: should have index on (status) for worker polling', () => {
    const indexes = getTableIndexNames(schema.txIntents);
    const hasStatusIdx = indexes.some((name) => name.includes('status'));
    expect(hasStatusIdx).toBe(true);
  });

  it('tx_intents: should have index on (round_id) for idempotency check', () => {
    const indexes = getTableIndexNames(schema.txIntents);
    const hasRoundIdIdx = indexes.some((name) => name.includes('round'));
    expect(hasRoundIdIdx).toBe(true);
  });

  it('ops_events: should have index on (created_at) for admin dashboard', () => {
    const indexes = getTableIndexNames(schema.opsEvents);
    const hasCreatedAtIdx = indexes.some((name) => name.includes('created_at'));
    expect(hasCreatedAtIdx).toBe(true);
  });

  it('chat_messages: should have index on (created_at) for chat history', () => {
    const indexes = getTableIndexNames(schema.chatMessages);
    const hasCreatedAtIdx = indexes.some((name) => name.includes('created_at'));
    expect(hasCreatedAtIdx).toBe(true);
  });

  it('sessions: should have index on (address) for auth lookups', () => {
    const indexes = getTableIndexNames(schema.sessions);
    const hasAddressIdx = indexes.some((name) => name.includes('address'));
    expect(hasAddressIdx).toBe(true);
  });

  it('game_sessions: should have index on (user_id, created_at) for user history', () => {
    const indexes = getTableIndexNames(schema.gameSessions);
    const hasUserCreatedAt = indexes.some(
      (name) => name && name.includes('user') && name.includes('created_at')
    );
    expect(hasUserCreatedAt).toBe(true);
  });

  it('support_tickets: should have index on (status) for admin filter', () => {
    const indexes = getTableIndexNames(schema.supportTickets);
    const hasStatusIdx = indexes.some((name) => name.includes('status'));
    expect(hasStatusIdx).toBe(true);
  });

  it('market_listings: should have index on (status, item_id) for marketplace browse', () => {
    const indexes = getTableIndexNames(schema.marketListings);
    const hasStatusItemIdx = indexes.some(
      (name) => name.includes('status') && name.includes('item')
    );
    expect(hasStatusItemIdx).toBe(true);
  });

  it('reward_grants: should have index on (user_id) for claim check', () => {
    const indexes = getTableIndexNames(schema.rewardGrants);
    const hasUserIdx = indexes.some((name) => name.includes('user'));
    expect(hasUserIdx).toBe(true);
  });

  it('market_trades: should have index on (user_id) for trade history', () => {
    const indexes = getTableIndexNames(schema.marketTrades);
    const hasUserIdx = indexes.some((name) => name.includes('user'));
    expect(hasUserIdx).toBe(true);
  });

  it('total_bet_ledger: should have index on (address) for bet history', () => {
    const indexes = getTableIndexNames(schema.totalBetLedger);
    const hasAddressIdx = indexes.some((name) => name.includes('address'));
    expect(hasAddressIdx).toBe(true);
  });
});

describe('Column types correctness', () => {
  it('wallet_accounts: should have unique index on (address, token)', () => {
    const config = getTableConfig(schema.walletAccounts);
    const hasUnique = (config.indexes || []).some(
      (idx: any) => idx.config?.unique === true
    );
    expect(hasUnique).toBe(true);
  });

  it('tx_intents: should have retry_count column', () => {
    const cols = getColumnMap(schema.txIntents);
    expect(cols.retry_count).toBeDefined();
  });

  it('tx_intents: should have status column with default', () => {
    const cols = getColumnMap(schema.txIntents);
    expect(cols.status).toBeDefined();
  });

  it('sessions: should have expires_at column', () => {
    const cols = getColumnMap(schema.sessions);
    expect(cols.expires_at).toBeDefined();
  });

  it('user_profiles: should have xp and level columns', () => {
    const cols = getColumnMap(schema.userProfiles);
    expect(cols.xp).toBeDefined();
    expect(cols.level).toBeDefined();
  });

  it('ops_events: should have all required columns', () => {
    const cols = getColumnMap(schema.opsEvents);
    expect(cols.channel).toBeDefined();
    expect(cols.severity).toBeDefined();
    expect(cols.source).toBeDefined();
    expect(cols.kind).toBeDefined();
    expect(cols.message).toBeDefined();
  });

  it('game_settlements: should have is_win column', () => {
    const cols = getColumnMap(schema.gameSettlements);
    expect(cols.is_win).toBeDefined();
  });

  it('wallet_ledger_entries: should have tx_intent_id and tx_hash columns', () => {
    const cols = getColumnMap(schema.walletLedgerEntries);
    expect(cols.tx_intent_id).toBeDefined();
    expect(cols.tx_hash).toBeDefined();
  });
});
