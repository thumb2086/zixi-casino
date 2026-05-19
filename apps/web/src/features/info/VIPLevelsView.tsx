import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, ChevronLeft, ChevronRight, Gift, Percent, MessageCircle, TrendingUp } from 'lucide-react';
import { LEVEL_TIERS } from '@repo/shared';
import AppBottomNav from '../../components/AppBottomNav';

export default function VIPLevelsView() {
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  const formatNumber = (num: number) => {
    if (num >= 1_000_000_000_000) return `${(num / 1_000_000_000_000).toFixed(1)}?†`;
    if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}?„`;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}?¾è¬`;
    if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
    return num.toString();
  };


  const gameFeeDiscountByThreshold = (threshold: number) => {
    if (threshold >= 100_000_000_000) return 100;
    if (threshold >= 50_000_000) return 50;
    if (threshold >= 1_000_000) return 20;
    if (threshold >= 100_000) return 10;
    return 0;
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link to="/app" className="text-[#adaaaa] transition-colors hover:text-[#fcc025]">
              <ChevronLeft size={24} />
            </Link>
            <Crown className="text-[#fcc025]" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
              VIP ç­‰ç?èªªæ?
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 pt-24">
        {/* ç­‰ç?ç¸½è¦½ */}
        <section className="mb-8 rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#141414] p-6 shadow-2xl">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
            ç­‰ç?ç³»çµ±ç¸½è¦½
          </h2>
          <p className="mt-3 text-sm font-bold text-[#adaaaa] leading-relaxed">
            ??{LEVEL_TIERS.length} ?‹ç?ç´šï?å¾æ™®?šæ??¡åˆ°ç¥è«­?ä??ã€‚ç?ç´šä??šæ‚¨?„ç¸½?•æ³¨é¡è?ç®—ï?ç­‰ç?è¶Šé?äº«æ?è¶Šå??¹æ???
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
              <div className="flex items-center gap-2">
                <Percent className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-bold text-[#adaaaa]">?€é«˜æ???/span>
              </div>
              <p className="mt-1 text-lg font-black text-emerald-400">100%</p>
            </div>
            <div className="rounded-xl border border-[#494847]/10 bg-[#0e0e0e] p-3">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-[#fcc025]" />
                <span className="text-xs font-bold text-[#adaaaa]">?€é«˜å€ç?</span>
              </div>
              <p className="mt-1 text-lg font-black text-[#fcc025]">8.0x</p>
            </div>
          </div>
        </section>

        {/* ?¹æ?èªªæ? */}
        <section className="mb-6 rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6">
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
            VIP ?¹æ?èªªæ?
          </h2>
          <div className="mt-4 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Percent className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">?Šæˆ²?‹ç?è²»æ???/h3>
                <p className="text-xs font-bold text-[#adaaaa]">
                  ä¾çµ±ä¸€è¦å?ï¼šæ™®???’é? 0%?ç™½?€ 10%?é???20%?é‘½??50%?å‰µä¸–ä»¥ä¸?100%
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#fcc025]/10">
                <Gift className="h-4 w-4 text-[#fcc025]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">æ¯æ—¥ç´…åˆ©?ç?</h3>
                <p className="text-xs font-bold text-[#adaaaa]">
                  æ¯æ—¥?»å…¥ç´…åˆ©ä¾ç?ç´šå€ç??¼æ”¾ï¼Œæ?é«˜å¯??8 ??
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                <MessageCircle className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">å½ˆå??¹æ?</h3>
                <p className="text-xs font-bold text-[#adaaaa]">
                  å°ˆå±¬å½ˆå?é¡è‰²?‡å„ª?ˆé¡¯ç¤ºæ?ï¼Œé?ç­‰ç??ƒå“¡?¼è??´é???
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">?®æ³¨ä¸Šé?</h3>
                <p className="text-xs font-bold text-[#adaaaa]">
                  ç­‰ç?è¶Šé??®æ³¨ä¸Šé?è¶Šé?ï¼Œç?è«­å?äºŒé??®æ³¨ä¸Šé?é«˜é? 10 ?ƒå?
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ç­‰ç??—è¡¨ */}
        <section className="space-y-3">
          <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
            å®Œæ•´ç­‰ç??—è¡¨
          </h2>
          {LEVEL_TIERS.map((tier, index) => (
            <div
              key={tier.label}
              className={`rounded-xl border p-4 transition-all ${
                index <= 5 
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
                    style={{ 
                      backgroundColor: `${tier.danmakuColor}20`,
                      color: tier.danmakuColor 
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-white">{tier.label}</h3>
                    <p className="text-xs font-bold text-[#adaaaa]">
                      ?€æª? {formatNumber(tier.threshold)}
                    </p>
                  </div>
                </div>
                <ChevronRight 
                  className={`h-5 w-5 text-[#494847] transition-transform ${
                    expandedTier === tier.label ? 'rotate-90' : ''
                  }`} 
                />
              </button>
              
              {expandedTier === tier.label && (
                <div className="mt-4 space-y-2 border-t border-[#494847]/10 pt-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">?®æ³¨ä¸Šé?</p>
                      <p className="text-sm font-black text-white">{formatNumber(tier.maxBet)}</p>
                    </div>
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">?‹ç?è²»æ???/p>
                      <p className="text-sm font-black text-emerald-400">
                        {gameFeeDiscountByThreshold(tier.threshold)}%
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">ç´…åˆ©?ç?</p>
                      <p className="text-sm font-black text-[#fcc025]">
                        {(tier.dailyBonusMultiplier || 1).toFixed(1)}x
                      </p>
                    </div>
                    <div className="rounded-lg bg-[#0e0e0e] p-2">
                      <p className="text-xs font-bold text-[#adaaaa]">å½ˆå?é¡è‰²</p>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-4 w-4 rounded"
                          style={{ backgroundColor: tier.danmakuColor }}
                        />
                        <span className="text-xs font-bold text-white">{tier.danmakuColor}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </section>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
