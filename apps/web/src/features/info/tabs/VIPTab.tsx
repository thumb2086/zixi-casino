import { useState } from 'react';
import { ChevronRight, Gift, Percent } from 'lucide-react';
import { LEVEL_TIERS } from '@repo/shared';

const formatThreshold = (value: number) => {
  if (value >= 1_000_000_000_000_000) return `${(value / 1_000_000_000_000_000).toFixed(0)}京`;
  if (value >= 1_000_000_000_000) return `${(value / 1_000_000_000_000).toFixed(1)}兆`;
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
};

export default function VIPTab() {
  const [expandedTier, setExpandedTier] = useState<string | null>('VIP 1');
  const [activeTab, setActiveTab] = useState<'member' | 'vip'>('member');

  return (
    <div className="space-y-6">

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('member')}
          className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'member'
              ? 'bg-[#fcc025] text-black'
              : 'border border-[#494847]/20 bg-[#1a1919] text-[#adaaaa]'
          }`}
        >
          會員等級 ({LEVEL_TIERS.length}級)
        </button>
        <button
          onClick={() => setActiveTab('vip')}
          className={`flex-1 rounded-xl py-3 text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === 'vip'
              ? 'bg-[#fcc025] text-black'
              : 'border border-[#494847]/20 bg-[#1a1919] text-[#adaaaa]'
          }`}
        >
          VIP 等級 (YJC持有)
        </button>
      </div>

      {activeTab === 'member' && (
        <>
          <section className="rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#141414] p-6 shadow-2xl">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">會員等級總覽</h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-[#adaaaa]">
              會員等級依照累積押注量提升。等級越高，可用單筆下注額度越高，並獲得更好的每日獎勵與市場手續費折扣。
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-[#adaaaa]">最高手續費減免</span>
                </div>
                <p className="mt-1 text-lg font-black text-emerald-400">
                  {Math.round(Math.max(...LEVEL_TIERS.map(t => t.marketFeeDiscount || 0)) * 100)}%
                </p>
              </div>
              <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-[#fcc025]" />
                  <span className="text-xs font-bold text-[#adaaaa]">最高每日獎勵倍率</span>
                </div>
                <p className="mt-1 text-lg font-black text-[#fcc025]">
                  {Math.max(...LEVEL_TIERS.map(t => t.dailyBonusMultiplier || 1)).toFixed(1)}x
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">{LEVEL_TIERS.length} 個會員等級</h2>
            {LEVEL_TIERS.map((tier, index) => (
              <div
                key={tier.label}
                className={`rounded-xl border p-4 transition-all ${
                  index >= 3
                    ? 'border-[#fcc025]/30 bg-gradient-to-r from-[#fcc025]/5 to-transparent'
                    : 'border-[#494847]/10 bg-[#1a1919]'
                }`}
              >
                <button
                  onClick={() => setExpandedTier(expandedTier === tier.label ? null : tier.label)}
                  className="flex w-full items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black"
                      style={{ backgroundColor: `${tier.danmakuColor}20`, color: tier.danmakuColor }}
                    >
                      {index + 1}
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-white">{tier.label}</h3>
                      <p className="text-xs font-bold text-[#adaaaa]">累計押注 {formatThreshold(tier.threshold)}</p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-[#494847] transition-transform ${expandedTier === tier.label ? 'rotate-90' : ''}`}
                  />
                </button>

                {expandedTier === tier.label && (
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#494847]/10 pt-4">
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">單筆下注上限</p>
                      <p className="text-sm font-black text-white">{formatThreshold(tier.maxBet)}</p>
                    </div>
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">市場費率折扣</p>
                      <p className="text-sm font-black text-emerald-400">{Math.round((tier.marketFeeDiscount || 0) * 100)}%</p>
                    </div>
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">每日獎勵倍率</p>
                      <p className="text-sm font-black text-[#fcc025]">{(tier.dailyBonusMultiplier || 1).toFixed(1)}x</p>
                    </div>
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">身份顏色</p>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 rounded" style={{ backgroundColor: tier.danmakuColor }} />
                        <span className="text-xs font-bold text-white">{tier.danmakuColor}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>
        </>
      )}

      {activeTab === 'vip' && (
        <>
          <section className="rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#141414] p-6 shadow-2xl">
            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">VIP 等級總覽</h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-[#adaaaa]">
              VIP 等級依照 <span className="text-[#fcc025]">佑件幣 (YJC) 持有量</span> 決定。持有越多，可進入更高級的專屬房間，並享有特殊特權。
            </p>
            <div className="mt-4 rounded-xl border border-[#fcc025]/20 bg-[#0e0e0e] p-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#adaaaa]">VIP 計算公式：</span>
                <span className="text-sm font-bold text-[#fcc025]">YJC 持有量決定 VIP 等級</span>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">3 個 VIP 等級</h2>

            <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#494847]/20 text-sm font-black text-[#adaaaa]">0</div>
                <div className="text-left">
                  <h3 className="font-bold text-[#adaaaa]">未達 VIP</h3>
                  <p className="text-xs font-bold text-[#494847]">YJC 持有量 0</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-bold text-[#adaaaa]">無專屬房間</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#fcc025]/30 bg-gradient-to-r from-[#fcc025]/5 to-transparent p-4">
              <button
                onClick={() => setExpandedTier(expandedTier === 'VIP 1' ? null : 'VIP 1')}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fcc025]/20 text-sm font-black text-[#fcc025]">1</div>
                  <div className="text-left">
                    <h3 className="font-bold text-[#fcc025]">VIP 1</h3>
                    <p className="text-xs font-bold text-[#adaaaa]">持有 1 - 999 YJC</p>
                  </div>
                </div>
                <ChevronRight className={`h-5 w-5 text-[#fcc025] transition-transform ${expandedTier === 'VIP 1' ? 'rotate-90' : ''}`} />
              </button>
              {expandedTier === 'VIP 1' && (
                <div className="mt-4 space-y-2 border-t border-[#494847]/10 pt-4">
                  <div className="rounded-lg bg-[#0e0e0e] p-3">
                    <p className="text-xs font-bold text-[#adaaaa]">可進入房間</p>
                    <p className="text-sm font-bold text-[#fcc025]">table_1 (VIP 專屬桌)</p>
                  </div>
                  <div className="rounded-lg bg-[#0e0e0e] p-3">
                    <p className="text-xs font-bold text-[#adaaaa]">特殊說明</p>
                    <p className="text-xs font-bold text-[#adaaaa]">基礎 VIP 資格，可進入第一級 VIP 專屬遊戲房間</p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[#fcc025]/50 bg-gradient-to-r from-[#fcc025]/10 to-transparent p-4">
              <button
                onClick={() => setExpandedTier(expandedTier === 'VIP 2' ? null : 'VIP 2')}
                className="flex w-full items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fcc025] text-sm font-black text-black">2</div>
                  <div className="text-left">
                    <h3 className="font-bold text-[#fcc025]">VIP 2</h3>
                    <p className="text-xs font-bold text-[#adaaaa]">持有 1,000+ YJC</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded border border-emerald-400/30 px-2 py-1 text-xs font-bold uppercase text-emerald-400">零手續費</span>
                  <ChevronRight className={`h-5 w-5 text-[#fcc025] transition-transform ${expandedTier === 'VIP 2' ? 'rotate-90' : ''}`} />
                </div>
              </button>
              {expandedTier === 'VIP 2' && (
                <div className="mt-4 space-y-2 border-t border-[#494847]/10 pt-4">
                  <div className="rounded-lg bg-[#0e0e0e] p-3">
                    <p className="text-xs font-bold text-[#adaaaa]">可進入房間</p>
                    <p className="text-sm font-bold text-[#fcc025]">table_1, table_2 (全部 VIP 房間)</p>
                  </div>
                  <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
                    <p className="text-xs font-bold text-emerald-400">⭐ 專屬特權</p>
                    <p className="text-sm font-black text-emerald-400">zero_fee (零手續費)</p>
                    <p className="text-xs font-bold text-[#adaaaa]">市場交易享有零手續費優惠</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
