import { useQuery } from '@tanstack/react-query';
import { api } from '../../../store/api';
import { ChevronRight } from 'lucide-react';

const TIER_COLORS: Record<string, string> = {
  '普通會員': '#a0a0a0', '普通菁英': '#a0a0a0',
  '青銅會員': '#cd7f32', '白銀會員': '#c0c0c0',
  '黃金會員': '#ffd700', '白金會員': '#00cfff',
  '鑽石': '#ff4fff', '黑鑽': '#ff4fff',
  '菁英': '#ff4fff', '宗師': '#ff4fff',
  '王者': '#ff4fff', '至尊': '#ff4fff',
  '蒼穹': '#ff4fff', '寰宇': '#ff4fff',
  '星穹': '#ff4fff', '萬界': '#ff4fff',
  '創世': '#ff4fff', '永恆': '#ff4fff',
  '深淵': '#ff4fff', '神諭': '#ff4fff',
  '神話': '#ff4fff',
};
function tierColor(label: string): string {
  for (const [key, color] of Object.entries(TIER_COLORS)) {
    if (label.includes(key)) return color;
  }
  return '#a0a0a0';
}

export default function VIPTab() {
  const { data: profile } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile as any;
    },
    staleTime: 30000,
  });

  const tierLabel = profile?.vipLevel || '普通會員';
  const tierColorVal = tierColor(tierLabel);
  const maxBet = profile?.maxBet || 1000;
  const level = profile?.level || 1;
  const xp = profile?.xp || 0;
  const xpNext = profile?.xpNextLevel || 0;
  const xpProgress = profile?.xpProgress || 0;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#141414] p-6 shadow-2xl">
        <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">會員等級</h2>
        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-black" style={{ background: `${tierColorVal}22`, color: tierColorVal, border: `2px solid ${tierColorVal}44` }}>
            Lv.{level}
          </div>
          <div>
            <p className="text-xl font-black" style={{ color: tierColorVal }}>{tierLabel}</p>
            <p className="text-xs font-bold text-[#adaaaa]">Lv.{level} — {xpProgress}%</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-4">
          <p className="text-xs font-bold text-[#adaaaa]">單注上限</p>
          <p className="mt-1 text-lg font-black text-white">{maxBet.toLocaleString()} ZXC</p>
        </div>
        <div className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-4">
          <p className="text-xs font-bold text-[#adaaaa]">經驗倍率</p>
          <p className="mt-1 text-lg font-black text-[#fcc025]">×{((maxBet > 1000000 ? 3 : maxBet > 100000 ? 2 : 1.5)).toFixed(1)}</p>
        </div>
      </section>

      <section className="rounded-xl border border-[#494847]/10 bg-[#1a1919] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-[#adaaaa]">經驗值進度</p>
          <p className="text-xs font-bold text-[#adaaaa]">{xp.toLocaleString()} / {xpNext.toLocaleString()}</p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#0e0e0e]">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${xpProgress}%`, background: `linear-gradient(90deg, ${tierColorVal}, #fcc025)` }} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">VIP 通行證</h2>

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
