import { useQuery } from '@tanstack/react-query';
import { api } from '../../../store/api';
import { ChevronRight } from 'lucide-react';

const LEVEL_LABELS: Record<number, string> = {
  1: '普通會員', 2: '普通菁英',
  3: '青銅會員', 4: '白銀會員', 5: '黃金會員', 6: '白金會員',
  7: '鑽石一階', 8: '鑽石二階',
  9: '黑鑽一階', 10: '黑鑽二階',
  11: '菁英一階', 12: '菁英二階',
  13: '宗師一階', 14: '宗師二階',
  15: '王者一階', 16: '王者二階',
  17: '至尊一階', 18: '至尊二階',
  19: '蒼穹一階', 20: '蒼穹二階',
  21: '寰宇一階', 22: '寰宇二階',
  23: '星穹一階', 24: '星穹二階',
  25: '萬界一階', 26: '萬界二階',
  27: '創世一階', 28: '創世二階',
  29: '永恆一階', 30: '永恆二階',
  31: '深淵一階', 32: '深淵二階',
  33: '神諭一階', 34: '神諭二階',
  35: '神諭三階', 36: '神諭四階',
  37: '神諭五階', 38: '神諭六階',
  39: '神諭七階', 40: '神諭八階',
  41: '神諭九階', 42: '神諭十階',
  43: '神諭十一階', 44: '神諭十二階',
  45: '神諭十三階', 46: '神諭十四階',
  47: '神諭十五階', 48: '神諭十六階',
  49: '神諭十七階', 50: '神話',
};

// XP thresholds per level (mirrors backend experience-manager.ts)
const XP_FOR_LEVEL: number[] = [
  0, 0, 10_000, 30_000, 100_000, 300_000, 600_000, 1_000_000, 2_000_000, 4_000_000,
  8_000_000, 15_000_000, 30_000_000, 50_000_000, 80_000_000, 150_000_000, 250_000_000,
  400_000_000, 600_000_000, 900_000_000, 1_500_000_000, 2_500_000_000, 4_000_000_000,
  6_000_000_000, 9_000_000_000, 15_000_000_000, 25_000_000_000, 40_000_000_000,
  60_000_000_000, 90_000_000_000, 150_000_000_000, 250_000_000_000, 400_000_000_000,
  650_000_000_000, 1_000_000_000_000, 1_500_000_000_000, 2_500_000_000_000,
  4_000_000_000_000, 6_500_000_000_000, 10_000_000_000_000, 16_000_000_000_000,
  25_000_000_000_000, 40_000_000_000_000, 65_000_000_000_000, 100_000_000_000_000,
  160_000_000_000_000, 250_000_000_000_000, 400_000_000_000_000, 650_000_000_000_000,
  850_000_000_000_000, 1_000_000_000_000_000,
];

export default function XpTab() {
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile || {};
    },
    staleTime: 30000,
  });

  const userLevel = profile?.level || 1;
  const userXp = profile?.xp || 0;
  const userTier = profile?.xpTierLabel || '普通會員';
  const nextLevelXp = profile?.xpNextLevel || 0;
  const xpProgress = profile?.xpProgress !== undefined ? profile.xpProgress : (nextLevelXp > 0 ? Math.round((Number(userXp) / nextLevelXp) * 100) : 0);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">我的經驗等級</p>
            <p className="text-3xl font-black italic text-[#fcc025] mt-1">Lv.{userLevel} <span className="text-sm font-bold text-[#adaaaa]">{userTier}</span></p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#adaaaa]">經驗值</p>
            <p className="text-sm font-black text-white">{Number(userXp).toLocaleString()} XP</p>
            {nextLevelXp > 0 && <p className="text-[10px] text-[#adaaaa] mt-0.5">下一級 {Number(nextLevelXp).toLocaleString()} XP</p>}
          </div>
        </div>
        {xpProgress > 0 && (
          <div className="w-full h-2 bg-[#0e0e0e] rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#fcc025] to-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, xpProgress)}%` }} />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] mb-3">如何獲得經驗值</h2>
        <ul className="space-y-2 text-sm text-white">
          <li className="flex items-center gap-2">🎰 遊戲下注 — 每 1 ZXC 下注 = 1 XP</li>
          <li className="flex items-center gap-2">⚡ 經驗加倍道具 — 使用後獲得雙倍 XP</li>
          <li className="flex items-center gap-2">🎉 活動加成 — 不定期開放多倍經驗活動</li>
        </ul>
      </section>

      <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
        <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa] mb-4">等級一覽</h2>
        <div className="space-y-1">
          {XP_FOR_LEVEL.slice(1).map((xp, idx) => {
            const lv = idx + 1;
            const label = LEVEL_LABELS[lv];
            const isCurrent = userLevel >= lv;
            return (
              <div key={lv}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                  userLevel === lv
                    ? 'bg-[#fcc025]/10 border border-[#fcc025]/30'
                    : 'bg-[#0e0e0e] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black w-8 ${isCurrent ? 'text-[#fcc025]' : 'text-[#494847]'}`}>
                    Lv.{lv}
                  </span>
                  <span className={`text-xs font-bold ${label ? 'text-white' : 'text-[#494847]'}`}>
                    {label || '—'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#adaaaa]">{xp.toLocaleString()} XP</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">VIP 通行證</h2>
        <p className="px-2 text-sm font-bold leading-relaxed text-[#adaaaa]">
          VIP 通行證可在 <span className="text-[#fcc025]">商城</span> 購買，購買後自動啟用對應的 VIP 權限。通行證為永久有效。
        </p>
        <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#494847]/20 text-sm font-black text-[#adaaaa]">0</div>
            <div className="text-left">
              <h3 className="font-bold text-[#adaaaa]">一般玩家</h3>
              <p className="text-xs font-bold text-[#494847]">無 VIP 通行證</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs font-bold text-[#adaaaa]">基本遊戲權限</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#fcc025]/30 bg-gradient-to-r from-[#fcc025]/5 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fcc025]/20 text-sm font-black text-[#fcc025]">1</div>
              <div className="text-left">
                <h3 className="font-bold text-[#fcc025]">VIP 1</h3>
                <p className="text-xs font-bold text-[#adaaaa]">購買 VIP 通行證</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-[#fcc025]" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#0e0e0e] p-3">
              <p className="text-xs font-bold text-[#adaaaa]">專屬房間</p>
              <p className="text-sm font-bold text-[#fcc025]">VIP 撲克房</p>
            </div>
            <div className="rounded-lg bg-[#0e0e0e] p-3">
              <p className="text-xs font-bold text-[#adaaaa]">任務解鎖</p>
              <p className="text-sm font-bold text-[#fcc025]">VIP 限定任務</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[#fcc025]/50 bg-gradient-to-r from-[#fcc025]/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#fcc025] text-sm font-black text-black">2</div>
              <div className="text-left">
                <h3 className="font-bold text-[#fcc025]">VIP 2</h3>
                <p className="text-xs font-bold text-[#adaaaa]">購買 VIP 2 通行證</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded border border-emerald-400/30 px-2 py-1 text-xs font-bold uppercase text-emerald-400">零手續費</span>
              <ChevronRight className="h-5 w-5 text-[#fcc025]" />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-[#0e0e0e] p-3">
              <p className="text-xs font-bold text-[#adaaaa]">專屬房間</p>
              <p className="text-sm font-bold text-[#fcc025]">全部 VIP 房間</p>
            </div>
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-500/5 p-3">
              <p className="text-xs font-bold text-emerald-400">⭐ 專屬特權</p>
              <p className="text-sm font-black text-emerald-400">零手續費</p>
              <p className="text-xs font-bold text-[#adaaaa]">市場交易零手續費</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
