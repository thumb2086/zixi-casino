import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Edit2,
  Globe,
  LogOut,
  Settings as SettingsIcon,
  Type,
  User,
  Volume2,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber, APP_VERSION } from '@repo/shared';
import { useAuthStore } from '../../store/useAuthStore';
import { useUserStore } from '../../store/useUserStore';
import { api } from '../../store/api';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useFontSizeStore } from '../../store/useFontSizeStore';
import AppBottomNav from '../../components/AppBottomNav';
import { useWallet } from '../wallet/useWallet';
import { resolvePreferredBalance } from '../../utils/balance';

const Toggle = ({ enabled, onClick }: { enabled: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={`relative inline-flex h-6 w-12 items-center rounded-full transition-all ${
      enabled ? 'bg-[#fcc025] shadow-[0_0_15px_rgba(252,192,37,0.35)]' : 'bg-[#494847]/30'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full transition-transform ${
        enabled ? 'translate-x-7 bg-black' : 'translate-x-1 bg-[#fcc025]'
      }`}
    />
  </button>
);

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#adaaaa]">
        <span>{label}</span>
        <span className="font-mono text-[#fcc025]">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        className="w-full accent-[#fcc025]"
      />
    </div>
  );
}

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { sessionId, clearAuth } = useAuthStore();
  const { username, address, balance, setUsername } = useUserStore();
  const { summary: walletSummaryQuery } = useWallet();
  const {
    amountDisplay,
    danmuEnabled,
    masterVolume,
    bgmEnabled,
    bgmVolume,
    sfxEnabled,
    sfxVolume,
    replacePrefs,
    setPrefs,
    hydrated,
  } = usePreferencesStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState(username || '');
  const { fontSize, setFontSize } = useFontSizeStore();

  const isZh = i18n.language.startsWith('zh');

  const ZXC_PER_YJC = 100_000_000;
  const previewZxc = resolvePreferredBalance({
    onchainBalance: walletSummaryQuery.data?.onchain?.zxc?.balance,
    onchainAvailable: walletSummaryQuery.data?.onchain?.zxc?.available,
    walletBalance: walletSummaryQuery.data?.summary?.balances?.ZXC,
    fallbackBalance: balance,
  });
  const previewYjc = resolvePreferredBalance({
    onchainBalance: walletSummaryQuery.data?.onchain?.yjc?.balance,
    onchainAvailable: walletSummaryQuery.data?.onchain?.yjc?.available,
    walletBalance: walletSummaryQuery.data?.summary?.balances?.YJC,
    fallbackBalance: '0',
  });
  const walletPreviewBalance = (Number(previewZxc || 0) + Number(previewYjc || 0) * ZXC_PER_YJC).toFixed(2);

  useEffect(() => {
    setDisplayNameDraft(username || '');
  }, [username]);

  useEffect(() => {
    setLoading(!hydrated);
  }, [hydrated]);

  const persistPrefs = async (updates: Partial<{
    amountDisplay: 'compact' | 'full';
    danmuEnabled: boolean;
    masterVolume: number;
    bgmEnabled: boolean;
    bgmVolume: number;
    sfxEnabled: boolean;
    sfxVolume: number;
  }>) => {
    if (!sessionId) return;
    setPrefs(updates);
    setSaving(true);
    setStatusText(t('settings.syncing_settings'));
    try {
      const res = await api.post('/api/v1/profile/prefs', { sessionId, prefs: updates });
      const payload = res.data;
      if (payload?.success === false) {
        setStatusText(t('settings.sync_failed'));
      } else {
        setStatusText(t('settings.settings_saved'));
      }
    } catch {
      setStatusText(t('settings.sync_failed'));
    } finally {
      setSaving(false);
      window.setTimeout(() => setStatusText(null), 1500);
    }
  };

  const saveDisplayName = async () => {
    const nextName = displayNameDraft.trim();
    if (!sessionId || nextName.length < 2 || nextName.length > 20) {
      setStatusText(t('profile.name_length_error'));
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/api/v1/profile/set-username', { sessionId, username: nextName });
      const payload = res.data;
      if (payload?.success === false) {
        setStatusText(payload?.error || t('profile.name_update_failed'));
        return;
      }

      // Reload canonical profile name from server to avoid stale local state
      const profileRes = await api.get('/api/v1/profile/prefs', { params: { sessionId } });
      const profilePayload = profileRes.data;
      const syncedName = profilePayload?.data?.displayName || nextName;
      setUsername(syncedName);
      setDisplayNameDraft(syncedName);
      setIsEditingName(false);
      setStatusText(t('profile.name_updated'));
    } catch {
      setStatusText(t('profile.name_update_failed'));
    } finally {
      setSaving(false);
      window.setTimeout(() => setStatusText(null), 1500);
    }
  };

  const previewBalance = useMemo(
    () => formatNumber(walletPreviewBalance || 0, amountDisplay === 'full' ? 'full' : 'short'),
    [amountDisplay, walletPreviewBalance]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0e0e0e]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#fcc025] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#0e0e0e] pb-32 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <SettingsIcon className="text-[#fcc025]" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">
              {t('settings.title')}
            </h1>
          </div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
            {saving ? t('settings.syncing') : `v${APP_VERSION}`}
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 pt-24">
        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="rounded-2xl bg-[#262626] p-3">
                <User className="text-[#fcc025]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">
                  {t('settings.profile')}
                </p>
                <p className="mt-1 text-xs font-bold text-[#6f6f6f]">{t('settings.name_hint')}</p>
                {isEditingName ? (
                  <div className="mt-3 flex flex-col gap-3">
                    <input
                      value={displayNameDraft}
                      maxLength={20}
                      onChange={(event) => setDisplayNameDraft(event.target.value)}
                      className="rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none focus:border-[#fcc025]/40"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={saveDisplayName}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#fcc025] px-4 py-2 text-xs font-black uppercase tracking-widest text-black"
                      >
                        <Check size={14} />
                        {t('common.save')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDisplayNameDraft(username || '');
                          setIsEditingName(false);
                        }}
                        className="rounded-xl border border-[#494847]/20 bg-[#262626] px-4 py-2 text-xs font-black uppercase tracking-widest text-white"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="mt-1 truncate text-2xl font-black uppercase italic tracking-tight">
                      {username || 'OPERATOR'}
                    </h2>
                    <p className="mt-1 truncate text-xs font-bold uppercase tracking-[0.18em] text-[#adaaaa]">
                      {address || t('settings.no_address')}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsEditingName(true)}
                      className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[#fcc025]/40 bg-[#262626] px-3 py-2 text-xs font-black uppercase tracking-widest text-[#fcc025] hover:bg-[#313131]"
                    >
                      <Edit2 size={12} />
                      {t('settings.edit_name')}
                    </button>
                  </>
                )}
              </div>
            </div>
            {!isEditingName && (
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#262626] text-[#fcc025] sm:flex"
              >
                <Edit2 size={16} />
              </button>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-[#494847]/10 bg-[#0e0e0e] p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {t('settings.balance_preview')}
            </p>
            <p className="mt-2 text-3xl font-black italic tracking-tight text-[#fcc025]">{previewBalance}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <Volume2 className="text-[#fcc025]" size={18} />
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">
              {t('settings.display_audio')}
            </h3>
          </div>

          <div className="mt-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-white">
                  {t('settings.amount_display')}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => persistPrefs({ amountDisplay: 'compact' })}
                    className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider ${
                      amountDisplay === 'compact' ? 'bg-[#fcc025] text-black' : 'bg-[#262626] text-white'
                    }`}
                  >
                    {t('settings.compact')}
                  </button>
                  <button
                    type="button"
                    onClick={() => persistPrefs({ amountDisplay: 'full' })}
                    className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider ${
                      amountDisplay === 'full' ? 'bg-[#fcc025] text-black' : 'bg-[#262626] text-white'
                    }`}
                  >
                    {t('settings.full')}
                  </button>
                </div>
              </div>
            </div>

            <SliderRow label={t('settings.master_volume')} value={masterVolume} onChange={(value) => persistPrefs({ masterVolume: value })} />
            <SliderRow label={t('settings.bgm_volume')} value={bgmVolume} onChange={(value) => persistPrefs({ bgmVolume: value })} />
            <SliderRow label={t('settings.sfx_volume')} value={sfxVolume} onChange={(value) => persistPrefs({ sfxVolume: value })} />

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#494847]/10 bg-[#0e0e0e] p-4 min-h-[74px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('settings.bgm')}</span>
                  <Toggle enabled={bgmEnabled} onClick={() => persistPrefs({ bgmEnabled: !bgmEnabled })} />
                </div>
              </div>
              <div className="rounded-2xl border border-[#494847]/10 bg-[#0e0e0e] p-4 min-h-[74px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('settings.sfx')}</span>
                  <Toggle enabled={sfxEnabled} onClick={() => persistPrefs({ sfxEnabled: !sfxEnabled })} />
                </div>
              </div>
              <div className="rounded-2xl border border-[#494847]/10 bg-[#0e0e0e] p-4 min-h-[74px]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider">{t('settings.danmaku')}</span>
                  <Toggle enabled={danmuEnabled} onClick={() => persistPrefs({ danmuEnabled: !danmuEnabled })} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <Type className="text-[#fcc025]" size={18} />
            <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">
               {t('settings.font_size')}
             </h3>
          </div>
          <div className="mt-4 flex gap-2">
            {(['small', 'medium', 'large'] as const).map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setFontSize(level)}
                className={`flex-1 rounded-xl px-4 py-3 text-xs font-black uppercase tracking-wider ${
                  fontSize === level ? 'bg-[#fcc025] text-black' : 'bg-[#262626] text-white'
                }`}
              >
                {level === 'small' ? t('settings.size_small') : level === 'medium' ? t('settings.size_medium') : t('settings.size_large')}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="text-[#fcc025]" size={18} />
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.18em] text-white">
                  {t('settings.language')}
                </h3>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#adaaaa]">
                  {isZh ? t('common.chinese') : t('common.english')}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => i18n.changeLanguage(isZh ? 'en' : 'zh')}
              className="rounded-xl border border-[#fcc025]/20 bg-[#262626] px-4 py-2 text-xs font-black uppercase tracking-[0.15em] text-[#fcc025]"
            >
              {t('settings.switch_label')}
            </button>
          </div>

          <div className="mt-6 divide-y divide-[#494847]/10 overflow-hidden rounded-2xl border border-[#494847]/10 bg-[#0e0e0e]">
            <Link to="/app/support" className="flex items-center justify-between p-4 transition-colors hover:bg-[#1a1919]">
              <span className="text-xs font-bold uppercase tracking-[0.12em]">
                {t('nav.support')}
              </span>
              <ChevronRight size={16} className="text-[#adaaaa]" />
            </Link>
            <a
              href="https://github.com/thumb2086/zixi-casino"
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between p-4 transition-colors hover:bg-[#1a1919]"
            >
              <span className="text-xs font-bold uppercase tracking-[0.12em]">
                {t('settings.github_repo')}
              </span>
              <ChevronRight size={16} className="text-[#adaaaa]" />
            </a>
          </div>
        </section>

        <section className="space-y-3 pb-4">
          <p className="min-h-[18px] text-center text-xs font-bold uppercase tracking-[0.12em] text-[#fcc025]">
            {statusText ?? ''}
          </p>
          <button
            type="button"
            onClick={() => {
              clearAuth();
              window.location.href = '/';
            }}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-600 to-red-800 py-4 text-sm font-black uppercase tracking-[0.2em]"
          >
            <LogOut size={18} />
            {t('settings.terminate_session')}
          </button>
        </section>
      </main>

          <AppBottomNav current="settings" />
            <p className="pb-4 text-center text-xs font-black uppercase tracking-[0.5em] text-[#494847]">{t('settings.footer', { version: APP_VERSION })}</p>
        </div>
  );
}
