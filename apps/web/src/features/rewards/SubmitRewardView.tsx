import { useEffect, useState, FormEvent } from 'react';
import { Loader2, Send, Check, X, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';

interface Submission {
  submissionId: string;
  type: 'avatar' | 'title';
  name: string;
  icon?: string | null;
  description?: string | null;
  rarity: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewNote?: string | null;
  createdAt?: string;
}

const STATUS_CONFIG: Record<string, { cls: string; Icon: typeof Clock }> = {
  pending: { cls: 'text-[#fcc025]', Icon: Clock },
  approved: { cls: 'text-emerald-400', Icon: Check },
  rejected: { cls: 'text-red-400', Icon: X },
};

const EMOJI_SUGGESTIONS = ['🎱', '🎲', '🃏', '🎰', '💎', '🌟', '⚡', '🔥', '🎯', '🪄', '👑', '🛡️', '🗡️', '🏆', '🎖️', '🎩', '🦾', '🐉', '🦁', '🐺'];

export default function SubmitRewardView() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sessionId } = useAuthStore();

  const [type, setType] = useState<'avatar' | 'title'>('avatar');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [description, setDescription] = useState('');
  const [rarity, setRarity] = useState<'common' | 'rare' | 'epic' | 'legendary' | 'mythic'>('common');
  const [submitting, setSubmitting] = useState(false);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  async function refresh() {
    if (!sessionId) return;
    setLoadingList(true);
    try {
      const res = await api.get('/api/v1/rewards/submissions/me').catch(() => null);
      if (res?.data?.data?.submissions) setMySubmissions(res.data.data.submissions);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (resultMsg) { const t = setTimeout(() => setResultMsg(null), 3000); return () => clearTimeout(t); }
  }, [resultMsg]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sessionId) {
      setResultMsg(t('submitReward.login_first'));
      return;
    }
    if (!name.trim()) {
      setResultMsg(t('submitReward.name_required'));
      return;
    }
    if (type === 'avatar' && !icon.trim()) {
      setResultMsg(t('submitReward.avatar_emoji_required'));
      return;
    }
    setSubmitting(true);
    setResultMsg(null);
    try {
      const res = await api.post('/api/v1/rewards/submissions', {
        sessionId,
        type,
        name: name.trim(),
        icon: icon.trim() || undefined,
        description: description.trim() || undefined,
        rarity,
      });
      const payload = res?.data?.data;
      if (payload?.error) {
        setResultMsg(payload.error.message || payload.error.code || t('submitReward.submit_failed'));
        return;
      }
      setResultMsg(t('submitReward.submit_success'));
      setName('');
      setIcon('');
      setDescription('');
      setRarity('common');
      refresh();
    } catch (err: any) {
      setResultMsg(
        err?.response?.data?.data?.error?.message ||
          err?.response?.data?.error?.message ||
          err?.message ||
          t('submitReward.submit_failed'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0e0e] pb-20 text-white">
      <header className="sticky top-0 z-10 border-b border-[#494847]/20 bg-[#0f0e0e]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1919] hover:bg-[#262626]"
          >
            <ArrowLeft size={16} />
          </button>
          <h1 className="text-lg font-black tracking-wide">{t('submitReward.title')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-[#494847]/20 bg-[#1a1919] p-6">
          <h2 className="mb-3 text-sm font-black">{t('submitReward.new_submission')}</h2>
          <p className="mb-4 text-xs text-[#adaaaa]">
            {t('submitReward.description')}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#adaaaa]">{t('submitReward.type_label')}</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setType('avatar')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-black transition-all ${
                    type === 'avatar'
                      ? 'border-[#fcc025] bg-[#fcc025]/10 text-[#fcc025]'
                      : 'border-[#494847]/30 bg-[#262626] text-[#adaaaa]'
                  }`}
                >
                   {t('submitReward.type_avatar')}
                </button>
                <button
                  type="button"
                  onClick={() => setType('title')}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-black transition-all ${
                    type === 'title'
                      ? 'border-[#fcc025] bg-[#fcc025]/10 text-[#fcc025]'
                      : 'border-[#494847]/30 bg-[#262626] text-[#adaaaa]'
                  }`}
                >
                  {t('submitReward.type_title')}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                {t('submitReward.name_label')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                placeholder={type === 'avatar' ? t('submitReward.name_placeholder_avatar') : t('submitReward.name_placeholder_title')}
                className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-sm text-white placeholder:text-[#494847] focus:border-[#fcc025] focus:outline-none"
              />
            </div>

            {type === 'avatar' && (
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                  {t('submitReward.emoji_label')}
                </label>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={8}
                  placeholder="🔥"
                  className="mb-2 w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-2xl text-white placeholder:text-[#494847] focus:border-[#fcc025] focus:outline-none"
                />
                <div className="flex flex-wrap gap-1">
                  {EMOJI_SUGGESTIONS.map((e) => (
                    <button
                      key={e}
                      type="button"
                      onClick={() => setIcon(e)}
                      className="flex h-8 w-8 items-center justify-center rounded-md bg-[#262626] text-lg hover:bg-[#fcc025]/20"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                {t('submitReward.description_label')}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={240}
                rows={3}
                placeholder={t('submitReward.description_placeholder')}
                className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-sm text-white placeholder:text-[#494847] focus:border-[#fcc025] focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
                {t('submitReward.rarity_label')}
              </label>
              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value as any)}
                className="w-full rounded-lg border border-[#494847]/30 bg-[#262626] px-3 py-2 text-sm text-white focus:border-[#fcc025] focus:outline-none"
              >
                <option value="common">{t('submitReward.rarity_common')}</option>
                <option value="rare">{t('submitReward.rarity_rare')}</option>
                <option value="epic">{t('submitReward.rarity_epic')}</option>
                <option value="legendary">{t('submitReward.rarity_legendary')}</option>
                <option value="mythic">{t('submitReward.rarity_mythic')}</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#fcc025] px-4 py-3 text-sm font-black text-black hover:brightness-110 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {t('submitReward.submit_btn')}
            </button>

            {resultMsg && (
              <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-[#1a1919] border border-[#fcc025]/40 shadow-lg shadow-black/50 text-sm font-bold text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
                {resultMsg}
              </div>
            )}
          </form>
        </section>

        <section className="rounded-2xl border border-[#494847]/20 bg-[#1a1919] p-6">
          <h2 className="mb-3 text-sm font-black">{t('submitReward.my_submissions')}</h2>
          {loadingList ? (
            <div className="flex items-center gap-2 text-xs text-[#adaaaa]">
              <Loader2 size={12} className="animate-spin" /> {t('submitReward.loading')}
            </div>
          ) : mySubmissions.length === 0 ? (
            <p className="text-xs text-[#adaaaa]">{t('submitReward.no_submissions')}</p>
          ) : (
            <ul className="space-y-3">
              {mySubmissions.map((sub) => {
                const st = STATUS_CONFIG[sub.status] || STATUS_CONFIG.pending;
                const StatusIcon = st.Icon;
                return (
                  <li
                    key={sub.submissionId}
                    className="rounded-lg border border-[#494847]/20 bg-[#262626] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1a1919] text-2xl">
                        {sub.icon || (sub.type === 'avatar' ? '👤' : '🏷')}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black">{sub.name}</span>
                          <span className="text-xs font-bold uppercase text-[#adaaaa]">
                            {sub.type === 'avatar' ? t('submitReward.type_avatar') : t('submitReward.type_title')}
                          </span>
                          <span className={`flex items-center gap-1 text-xs font-bold uppercase ${st.cls}`}>
                            <StatusIcon size={10} />
                            {t(`submitReward.status_${sub.status}`)}
                          </span>
                        </div>
                        {sub.description && (
                          <p className="mt-1 text-xs text-[#adaaaa] break-words">{sub.description}</p>
                        )}
                        {sub.reviewNote && (
                          <p className="mt-1 text-xs text-[#adaaaa]">{t('submitReward.review_note', { note: sub.reviewNote })}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
