import { useEffect, useMemo, useState } from 'react';
import {
  Megaphone, AlertTriangle, ShieldAlert, Gift,
  ChevronDown, Loader2, X,
} from 'lucide-react';
import { formatNumber } from '@repo/shared';
import { useTranslation } from 'react-i18next';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import AppBottomNav from '../../components/AppBottomNav';

type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'urgent';
  createdAt: string;
  active: boolean;
};

interface Campaign {
  campaignId: string;
  title: string;
  description?: string | null;
  isActive?: boolean;
  startAt?: string | null;
  endAt?: string | null;
  maxClaimsPerUser?: number;
  rewards?: any;
  claimed?: boolean;
}

const REWARD_NAMES: Record<string, string> = {
  title_newbie: '初心者', title_gambler: '賭徒', title_highroller: '豪客',
  title_god: '賭神', title_member_1: '普通會員', title_member_2: '銅牌會員',
  title_member_3: '銀牌會員', title_member_4: '金牌會員', title_member_5: '白金會員',
  title_member_6: '鑽石會員', title_member_7: '星辰會員', title_member_8: '皓月會員',
  title_member_9: '驕陽會員', title_member_10: '至尊會員', title_member_11: '天選之人',
  title_member_12: '不朽傳奇', title_member_13: '永恆神話', title_member_14: '深淵凝視',
  title_member_15: '虛空行者', title_member_16: '混沌主宰', title_member_17: '命運編織者',
  title_member_18: '時光守護者', title_member_19: '創世之光', title_member_20: '終焉審判',
  title_member_21: '輪迴之主', title_member_22: '太初之始', title_member_23: '無極之境',
  title_member_24: '大道歸一', title_member_25: '鴻蒙聖人', title_member_26: '天道化身',
  title_member_27: '規則制定者', title_member_28: '宇宙之心', title_member_29: '萬物之源',
  title_member_30: '超越者', title_member_31: '至高神座', title_member_32: '神諭十二階',
  chest_key_common: '普通寶箱鑰匙', chest_key_rare: '稀有寶箱鑰匙',
  chest_key_epic: '史詩寶箱鑰匙', chest_key_legendary: '傳奇寶箱鑰匙',
  chest_key_mythic: '神話寶箱鑰匙',
};

function formatRelativeTime(value: string, t: (key: string, opts?: any) => string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  if (minutes < 1) return t('common.just_now');
  if (minutes < 60) return t('common.minutes_ago', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('common.hours_ago', { count: hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return t('common.yesterday');
  return t('common.days_ago', { count: days });
}

function resolveRewardName(id: string): string {
  return REWARD_NAMES[id] || id;
}

function formatRewardSummary(r: any): string {
  if (!r || typeof r !== 'object') return '獎勵';
  const parts: string[] = [];
  if (typeof r.zxc === 'number' && r.zxc > 0) parts.push(`${formatNumber(r.zxc)} ZXC`);
  if (typeof r.yjc === 'number' && r.yjc > 0) parts.push(`${formatNumber(r.yjc)} YJC`);
  if (Array.isArray(r.items) && r.items.length > 0) {
    const labels = r.items.map((it: any) => {
      const name = it.name || resolveRewardName(it.id || '') || it.id || '道具';
      const qty = it.qty || 1;
      return qty > 1 ? `${name} ×${qty}` : name;
    });
    parts.push(labels.join('、'));
  }
  if (Array.isArray(r.avatars) && r.avatars.length) parts.push(`頭像：${r.avatars.map((a: string) => resolveRewardName(a)).join('、')}`);
  if (Array.isArray(r.titles) && r.titles.length) parts.push(`稱號：${r.titles.map((t: string) => resolveRewardName(t)).join('、')}`);
  return parts.length ? parts.join(' + ') : '獎勵';
}

export default function AnnouncementCenter() {
  const { t } = useTranslation();
  const { sessionId } = useAuthStore();
  const { amountDisplay } = usePreferencesStore();
  const nf = (v: number | string) => formatNumber(v, amountDisplay === 'full' ? 'full' : 'short');

  const [filter, setFilter] = useState<'ANNOUNCEMENT' | 'EVENTS'>('ANNOUNCEMENT');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<AnnouncementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [successBundle, setSuccessBundle] = useState<any>(null);

  useEffect(() => {
    api.get('/api/v1/announcements')
      .then((res) => { setItems(Array.isArray(res.data.data) ? res.data.data : []); })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.get('/api/v1/rewards/campaigns')
      .then((res) => { setCampaigns(res?.data?.data?.campaigns || []); })
      .catch(() => setCampaigns([]))
      .finally(() => setCampaignsLoading(false));
  }, [sessionId]);

  useEffect(() => {
    if (claimMsg) { const t2 = setTimeout(() => setClaimMsg(null), 3000); return () => clearTimeout(t2); }
  }, [claimMsg]);

  const featured = useMemo(() => {
    return items.find((item) => item.type === 'urgent') || items[0] || null;
  }, [items]);

  const getBadgeStyle = (type: AnnouncementItem['type']) => {
    switch (type) {
      case 'urgent': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'warning': return 'bg-[#fcc025]/10 text-[#fcc025] border-[#fcc025]/20';
      default: return 'bg-white/10 text-white border-white/20';
    }
  };

  const typeLabel = (type: AnnouncementItem['type']) => {
    if (type === 'urgent') return t('announcement.type_urgent');
    if (type === 'warning') return t('announcement.type_warning');
    return t('announcement.events');
  };

  async function claim(campaignId: string) {
    if (!sessionId) { setClaimMsg('請先登入'); return; }
    setClaimMsg(null);
    try {
      const res = await api.post(`/api/v1/rewards/campaigns/${encodeURIComponent(campaignId)}/claim`, { sessionId });
      const payload = res?.data?.data;
      if (payload?.error) { setClaimMsg(payload.error.message || payload.error.code || '領取失敗'); return; }
      setSuccessBundle(payload?.bundle || null);
      setClaimMsg('領取成功');
      const refreshed = await api.get('/api/v1/rewards/campaigns');
      setCampaigns(refreshed?.data?.data?.campaigns || []);
    } catch (err: any) {
      setClaimMsg(err?.response?.data?.data?.error?.message || err?.response?.data?.error?.message || err?.message || '領取失敗');
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-[#0e0e0e]/90 backdrop-blur-xl border-b border-[#494847]/15">
        <div className="flex items-center justify-between px-6 py-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-4">
            <Megaphone className="text-[#fcc025]" />
            <h1 className="font-extrabold tracking-tight text-xl text-[#fcc025] uppercase italic">公告與活動</h1>
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 max-w-2xl mx-auto space-y-8">
        {/* Tabs */}
        <div className="flex bg-[#1a1919] p-1.5 rounded-xl border border-[#494847]/20">
          {(['ANNOUNCEMENT', 'EVENTS'] as const).map((entry) => (
            <button key={entry} type="button" onClick={() => setFilter(entry)}
              className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${filter === entry ? 'bg-[#fcc025] text-black shadow-lg' : 'text-[#adaaaa] hover:text-white'}`}
            >
              {entry === 'ANNOUNCEMENT' ? '公告' : '活動'}
            </button>
          ))}
        </div>

        {/* Announcements Tab */}
        {filter === 'ANNOUNCEMENT' && (
          <>
            <section className="bg-gradient-to-br from-red-600/20 to-transparent rounded-2xl p-6 border border-red-500/30 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                <ShieldAlert size={80} />
              </div>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="text-red-500 animate-pulse" size={20} />
                <span className="text-xs font-black uppercase tracking-[0.2em] text-red-500">{t('announcement.critical_alert')}</span>
              </div>
              <h2 className="text-2xl font-black italic tracking-tighter uppercase mb-2">
                {featured?.title || t('announcement.no_active')}
              </h2>
              <p className="text-xs text-[#adaaaa] font-bold uppercase leading-relaxed mb-6">
                {featured?.content || t('announcement.feed_online')}
              </p>
              <div className="text-xs font-black uppercase tracking-widest text-white/70">
                {featured ? formatRelativeTime(featured.createdAt, t) : 'SYNCED'}
              </div>
            </section>

            <div className="flex items-center gap-2 px-2">
              <div className="w-1 h-3 bg-[#fcc025] rounded-full" />
              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-[#adaaaa]">{t('announcement.system_alerts')}</h3>
            </div>

            <section className="space-y-4">
              {loading && (
                <div className="bg-[#1a1919] rounded-xl p-5 border border-[#494847]/10 text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                  {t('announcement.loading')}
                </div>
              )}
              {!loading && items.length === 0 && (
                <div className="bg-[#1a1919] rounded-xl p-5 border border-[#494847]/10 text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                  {t('announcement.no_category')}
                </div>
              )}
              {items.map((item) => {
                const isExpanded = expandedId === item.id;
                return (
                  <div key={item.id} onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    className="bg-[#1a1919] rounded-xl p-5 border border-[#494847]/10 group hover:bg-[#201f1f] transition-all cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-3 flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-sm border ${getBadgeStyle(item.type)}`}>
                            {typeLabel(item.type)}
                          </span>
                          <span className="text-xs font-bold text-[#494847] uppercase tracking-widest">{formatRelativeTime(item.createdAt, t)}</span>
                        </div>
                        <div>
                          <h4 className="text-sm font-bold uppercase tracking-tight text-white group-hover:text-[#fcc025] transition-colors">{item.title}</h4>
                          <p className={`text-xs text-[#adaaaa] font-bold mt-1 ${isExpanded ? '' : 'line-clamp-2'}`}>{item.content}</p>
                        </div>
                      </div>
                      <ChevronDown size={16} className={`shrink-0 text-[#494847] group-hover:text-[#fcc025] transition-all duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`} />
                    </div>
                  </div>
                );
              })}
            </section>
          </>
        )}

        {/* Events Tab */}
        {filter === 'EVENTS' && (
          <section className="space-y-4">
            {claimMsg && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border border-[#fcc025]/40 shadow-lg shadow-black/50 text-sm font-bold text-white whitespace-nowrap">
                {claimMsg}
              </div>
            )}
            {campaignsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-[#fcc025]" size={24} /></div>
            ) : campaigns.length === 0 ? (
              <div className="rounded-2xl border border-[#494847]/20 bg-[#1a1919] px-4 py-8 text-center text-sm text-[#adaaaa]">
                目前沒有進行中的活動
              </div>
            ) : (
              campaigns.map((c) => (
                <section key={c.campaignId} className="rounded-2xl border border-[#494847]/20 bg-[#1a1919] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-black text-white">{c.title}</h2>
                      {c.description && <p className="mt-1 text-sm text-[#adaaaa] break-words">{c.description}</p>}
                    </div>
                    <Gift size={18} className="shrink-0 text-[#fcc025]" />
                  </div>
                  <div className="mt-3 rounded-lg bg-[#262626] px-3 py-2 text-sm text-[#fcc025]">
                    {formatRewardSummary(c.rewards)}
                  </div>
                  {(c.startAt || c.endAt) && (
                    <p className="mt-2 text-sm text-[#adaaaa]">
                      {c.startAt ? new Date(c.startAt).toLocaleString() : '即刻'} ~ {c.endAt ? new Date(c.endAt).toLocaleString() : '無期限'}
                    </p>
                  )}
                  <button type="button" disabled={Boolean(c.claimed) || !sessionId}
                    onClick={() => claim(c.campaignId)}
                    className="mt-3 w-full rounded-lg bg-[#fcc025] px-3 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50 hover:brightness-110"
                  >
                    {c.claimed ? '已領取' : !sessionId ? '請先登入' : '領取獎勵'}
                  </button>
                </section>
              ))
            )}
          </section>
        )}
      </main>

      {successBundle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4" onClick={() => setSuccessBundle(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-[#494847]/20 bg-[#1a1919] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-[#fcc025]">🎉 領取成功</h3>
              <button type="button" onClick={() => setSuccessBundle(null)} className="rounded-lg p-1 hover:bg-white/10"><X size={16} /></button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-white">
              {successBundle.zxc > 0 && <p>+ {nf(Number(successBundle.zxc))} ZXC</p>}
              {successBundle.yjc > 0 && <p>+ {nf(Number(successBundle.yjc))} YJC</p>}
              {Array.isArray(successBundle.items) && successBundle.items.map((it: any, i: number) => (
                <p key={i}>道具：{it.name || resolveRewardName(it.id) || it.id} {it.qty > 1 ? `×${it.qty}` : ''}</p>
              ))}
              {Array.isArray(successBundle.avatars) && successBundle.avatars.map((a: any, i: number) => (
                <p key={i}>頭像：{a.name || resolveRewardName(a.id || a) || a.id || a}</p>
              ))}
              {Array.isArray(successBundle.titles) && successBundle.titles.map((t: any, i: number) => (
                <p key={i}>稱號：{t.name || resolveRewardName(t.id || t) || t.id || t}</p>
              ))}
            </div>
            <button type="button" onClick={() => setSuccessBundle(null)} className="mt-4 w-full rounded-lg bg-[#fcc025] px-3 py-2 text-sm font-black text-black">確定</button>
          </div>
        </div>
      )}

      <AppBottomNav current="none" />
    </div>
  );
}
