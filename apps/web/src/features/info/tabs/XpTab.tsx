import { useQuery } from '@tanstack/react-query';
import { api } from '../../../store/api';

const XP_THRESHOLDS: { level: number; xp: string; label: string }[] = [
  { level: 1, xp: '0', label: '普通會員' },
  { level: 2, xp: '10,000', label: '' },
  { level: 3, xp: '30,000', label: '青銅會員' },
  { level: 4, xp: '100,000', label: '' },
  { level: 5, xp: '300,000', label: '白銀會員' },
  { level: 6, xp: '600,000', label: '' },
  { level: 7, xp: '1,000,000', label: '' },
  { level: 8, xp: '2,000,000', label: '黃金會員' },
  { level: 9, xp: '4,000,000', label: '' },
  { level: 10, xp: '8,000,000', label: '' },
  { level: 11, xp: '15,000,000', label: '白金會員' },
  { level: 12, xp: '30,000,000', label: '' },
  { level: 13, xp: '50,000,000', label: '' },
  { level: 14, xp: '80,000,000', label: '鑽石等級' },
  { level: 15, xp: '150,000,000', label: '' },
  { level: 16, xp: '250,000,000', label: '' },
  { level: 17, xp: '400,000,000', label: '黑鑽等級' },
  { level: 18, xp: '600,000,000', label: '' },
  { level: 19, xp: '900,000,000', label: '' },
  { level: 20, xp: '1,500,000,000', label: '菁英等級' },
  { level: 21, xp: '2,500,000,000', label: '' },
  { level: 22, xp: '4,000,000,000', label: '宗師等級' },
  { level: 23, xp: '6,000,000,000', label: '' },
  { level: 24, xp: '9,000,000,000', label: '王者等級' },
  { level: 25, xp: '15,000,000,000', label: '' },
  { level: 26, xp: '25,000,000,000', label: '至尊等級' },
  { level: 27, xp: '40,000,000,000', label: '' },
  { level: 28, xp: '60,000,000,000', label: '蒼穹等級' },
  { level: 29, xp: '90,000,000,000', label: '' },
  { level: 30, xp: '150,000,000,000', label: '寰宇等級' },
  { level: 31, xp: '250,000,000,000', label: '' },
  { level: 32, xp: '400,000,000,000', label: '星穹等級' },
  { level: 33, xp: '650,000,000,000', label: '' },
  { level: 34, xp: '1 兆', label: '神諭等級' },
  { level: 35, xp: '1.5 兆', label: '神諭一階' },
  { level: 36, xp: '2.5 兆', label: '' },
  { level: 37, xp: '4 兆', label: '神諭二階' },
  { level: 38, xp: '6.5 兆', label: '' },
  { level: 39, xp: '10 兆', label: '神諭三階' },
  { level: 40, xp: '16 兆', label: '' },
  { level: 41, xp: '25 兆', label: '神諭四階' },
  { level: 42, xp: '40 兆', label: '' },
  { level: 43, xp: '65 兆', label: '神諭五階' },
  { level: 44, xp: '100 兆', label: '' },
  { level: 45, xp: '160 兆', label: '神諭六階' },
  { level: 46, xp: '250 兆', label: '' },
  { level: 47, xp: '400 兆', label: '神諭七階' },
  { level: 48, xp: '650 兆', label: '' },
  { level: 49, xp: '850 兆', label: '神諭八階' },
  { level: 50, xp: '1000 兆', label: '神諭九階' },
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">我的經驗等級</p>
            <p className="text-3xl font-black italic text-[#fcc025] mt-1">Lv.{userLevel}</p>
            <p className="text-sm font-bold text-[#adaaaa] mt-1">{userTier}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[#adaaaa]">經驗值</p>
            <p className="text-sm font-black text-white">{Number(userXp).toLocaleString()} XP</p>
          </div>
        </div>
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
          {XP_THRESHOLDS.map((tier) => {
            const isCurrent = userLevel >= tier.level;
            return (
              <div key={tier.level}
                className={`flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                  userLevel === tier.level
                    ? 'bg-[#fcc025]/10 border border-[#fcc025]/30'
                    : 'bg-[#0e0e0e] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black w-8 ${isCurrent ? 'text-[#fcc025]' : 'text-[#494847]'}`}>
                    Lv.{tier.level}
                  </span>
                  <span className={`text-xs font-bold ${tier.label ? 'text-white' : 'text-[#494847]'}`}>
                    {tier.label || '—'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-[#adaaaa]">{tier.xp} XP</span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
