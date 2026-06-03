import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  ChevronRight,
  Copy,
  Gift,
  History,
  QrCode,
  Repeat2,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '@repo/shared';
import { QRCodeSVG } from 'qrcode.react';
import { usePreferencesStore } from '../../store/usePreferencesStore';
import { useUserStore } from '../../store/useUserStore';
import AppBottomNav from '../../components/AppBottomNav';
import { useWallet } from './useWallet';
import { resolvePreferredBalance } from '../../utils/balance';

function AssetCard({
  label,
  value,
  token,
}: {
  label: string;
  value: string;
  token: string;
}) {
  return (
    <div className="rounded-2xl border border-border/10 bg-card p-5 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-3xl font-black italic tracking-tight text-accent">{value}</p>
        <span className="text-xs font-bold uppercase tracking-widest text-white">{token}</span>
      </div>
    </div>
  );
}



export default function WalletView() {
  const { t } = useTranslation();
  const { amountDisplay } = usePreferencesStore();
  const { balance: syncedBalance, address: userAddress } = useUserStore();
  const { summary, airdrop, transfer, convert } = useWallet();
  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: async () => {
      const res = await api.get('/api/v1/me/profile');
      return res.data?.data?.profile || {};
    },
    staleTime: 30000,
  });
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferToken, setTransferToken] = useState<'zhixi' | 'yjc'>('zhixi');
  const [convertAmount, setConvertAmount] = useState('');
  const [copied, setCopied] = useState(false);

  const myAddress = userAddress || '';

  const handleCopyAddress = async () => {
    if (!myAddress) return;
    try {
      await navigator.clipboard.writeText(myAddress);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore ?? clipboard API may be blocked in some environments */
    }
  };

  const numberMode = amountDisplay === 'full' ? 'full' : 'short';

  const walletSummary = summary.data?.summary;
  const assets = summary.data?.assets;
  const onchain = summary.data?.onchain;
  const canClaimAirdrop = summary.data?.canClaimAirdrop ?? true;
  const nextAirdropAt = summary.data?.nextAirdropAt;
  const checkinStreak = summary.data?.checkinStreak ?? 0;
  const checkinHistory: string[] = summary.data?.checkinHistory || [];
  const zxcBalance = resolvePreferredBalance({
    onchainBalance: onchain?.zxc?.balance,
    onchainAvailable: onchain?.zxc?.available,
    walletBalance: walletSummary?.balances?.ZXC,
    fallbackBalance: syncedBalance,
  });
  const yjcBalance = resolvePreferredBalance({
    onchainBalance: onchain?.yjc?.balance,
    onchainAvailable: onchain?.yjc?.available,
    walletBalance: walletSummary?.balances?.YJC,
  });
  const ZXC_PER_YJC = 100_000_000;
  const marketNetWorth = assets?.market?.overlayNetWorth || assets?.market?.netWorth || '0';
  const zxcNum = Number(zxcBalance || 0);
  const yjcNum = Number(yjcBalance || 0);
  const walletOnlyTotal = (zxcNum + yjcNum * ZXC_PER_YJC).toFixed(2);
  const totalBalance = (Number(walletOnlyTotal) + Number(marketNetWorth || 0)).toFixed(2);

  const nextAirdropLabel = useMemo(() => {
    if (canClaimAirdrop) return t('vault.airdrop_now');
    // Show next midnight in user's local time
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return `?日 ${tomorrow.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
  }, [canClaimAirdrop, t]);

  return (
    <div className="min-h-screen bg-surface pb-40 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-border/20 bg-surface/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <WalletIcon className="text-secondary" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-white">{t('vault.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app/shop" className="text-xs font-bold uppercase tracking-[0.18em] text-info">
              ×
            </Link>
            <Link to="/app/swap" className="text-xs font-bold uppercase tracking-[0.18em] text-info">
              {t('swap.title')}
            </Link>
            <Link to="/app/transactions" className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
              {t('nav.feed')}
            </Link>
          </div>
        </div>
      </header>

      <main className="app-shell flex flex-col gap-6 pt-24">
        <section className="rounded-[2rem] border border-border/10 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-8 shadow-[0_0_50px_rgba(252,192,37,0.08)]">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-secondary">{t('vault.total_assets')}</p>
          <p className="mt-4 text-5xl font-black italic tracking-tighter text-accent">
            {formatNumber(totalBalance, numberMode)}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-[0.16em] text-secondary">
            <span>{t('vault.wallet')} {formatNumber(walletOnlyTotal, numberMode)}</span>
            <span>{t('market.title')} {formatNumber(marketNetWorth, numberMode)}</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <AssetCard label={t('vault.zxc_label')} value={formatNumber(zxcBalance, numberMode)} token="ZXC" />
            <AssetCard label={t('vault.yjc_label')} value={formatNumber(yjcBalance, numberMode)} token={t('wallet.yjc_with_zxc', { amount: formatNumber(yjcNum * ZXC_PER_YJC, numberMode) })} />
          </div>
        </section>

        {/* XP Section */}
        {profileData?.level ? (
          <section className="card-accent bg-card p-6 border border-border/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">經驗等級</p>
                <p className="text-3xl font-black italic text-accent mt-1">Lv.{profileData.level} <span className="text-sm font-bold text-secondary">{profileData.xpTierLabel || ''}</span></p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-white">{nf(profileData.xp || 0)} XP</p>
                {profileData.xpNextLevel > 0 && (
                  <p className="text-caption text-secondary mt-0.5">下一級 {nf(profileData.xpNextLevel)} XP</p>
                )}
              </div>
            </div>
            {profileData.xpProgress !== undefined && (
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#fcc025] to-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, profileData.xpProgress)}%` }} />
              </div>
            )}
          </section>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="card-accent bg-card p-6 border border-border/10">
            <div className="flex items-center gap-3 mb-3">
              <Gift className="text-accent" size={18} />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">{t('vault.daily_airdrop')}</h2>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex flex-col items-center bg-surface rounded-xl px-4 py-2">
                <span className="text-2xl font-black italic text-accent">{checkinStreak}</span>
                <span className="text-caption font-bold text-secondary">簽到天數</span>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-secondary">{t('vault.next_available')}{nextAirdropLabel}</p>
                <p className="text-xs font-bold text-secondary mt-1">獎勵 {((1 + checkinStreak * 0.05)).toFixed(2)}</p>
              </div>
            </div>
            {/* Calendar grid: last 30 days */}
            <div className="grid grid-cols-7 gap-1 mb-3">
              {Array.from({ length: 30 }, (_, i) => {
                const d = new Date(Date.now() - (29 - i) * 86400000);
                const dateStr = d.toISOString().slice(0, 10);
                const checked = checkinHistory.includes(dateStr);
                const isToday = i === 29;
                return (
                  <div key={i} className={`aspect-square rounded flex items-center justify-center text-[9px] font-bold ${
                    isToday ? 'ring-1 ring-[#fcc025]' : ''
                  } ${
                    checked ? 'bg-accent text-black' : 'bg-surface text-muted'
                  }`}>
                    {d.getDate()}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              disabled={!canClaimAirdrop || airdrop.isPending}
              onClick={() => airdrop.mutate()}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ArrowDownCircle size={16} />
              {airdrop.isPending ? t('vault.claiming') : t('vault.claim_airdrop')}
            </button>
            {airdrop.error?.message && (
              <p className="mt-2 text-xs font-bold text-danger">{airdrop.error.message}</p>
            )}
          </div>

          <div className="card-info bg-card p-6 border border-border/10 md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <History size={18} className="text-info" />
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">交易紀錄</h2>
              </div>
              <Link to="/app/transactions" className="text-caption font-bold text-secondary hover:text-accent">檢視全部</Link>
            </div>
            <div className="space-y-2">
              {summary.isLoading && <div className="text-xs text-secondary">載入中...</div>}
              {!summary.isLoading && (!walletSummary?.recentTransactions || walletSummary.recentTransactions.length === 0) && <div className="text-xs text-secondary">暫無交易</div>}
              {(walletSummary?.recentTransactions || []).slice(0, 10).map((tx: any) => {
                const amt = Number(tx.amount);
                const isCredit = amt >= 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between rounded-xl border border-border/10 bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{t('txType.' + tx.type, tx.type)}</p>
                      <p className="text-caption text-secondary mt-0.5">{new Date(tx.createdAt).toLocaleString('zh-TW')}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className={`text-xs font-bold ${isCredit ? 'text-emerald-400' : 'text-danger'}`}>
                        {isCredit ? '+' : ''}{formatNumber(amt, numberMode)} {(tx.token === 'zhixi' ? 'ZXC' : tx.token === 'yjc' ? 'YJC' : tx.token || tx.tokenSymbol || 'ZXC')}
                      </p>
                      <p className="text-caption text-secondary">{tx.status ? t('txStatus.' + tx.status, tx.status) : '已確認'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card-info bg-card p-6 border border-border/10">
            <div className="flex items-center gap-3 mb-3">
              <Repeat2 className="text-info" size={18} />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">{t('vault.transfer')}</h2>
            </div>
            <div className="grid gap-3">
              <input
                value={transferTo}
                onChange={(event) => setTransferTo(event.target.value)}
                placeholder={t('vault.recipient_placeholder')}
                className="rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
              />
              <div className="grid grid-cols-[1fr_100px] gap-2">
                <input
                  value={transferAmount}
                  onChange={(event) => setTransferAmount(event.target.value)}
                  placeholder={t('market.amount')}
                  className="rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm font-bold outline-none focus:border-accent/40"
                />
                <select
                  value={transferToken}
                  onChange={(event) => setTransferToken(event.target.value as 'zhixi' | 'yjc')}
                  className="rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm font-bold outline-none"
                >
                  <option value="zhixi">ZXC</option>
                  <option value="yjc">YJC</option>
                </select>
              </div>
              <button
                type="button"
                disabled={!transferTo || !transferAmount || transfer.isPending}
                onClick={() => transfer.mutate({ to: transferTo, amount: transferAmount, token: transferToken })}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowUpCircle size={16} />
                {transfer.isPending ? t('vault.sending') : t('vault.send_transfer')}
              </button>
            </div>
          </div>
        </div>

        {myAddress && (
          <div className="rounded-2xl border border-border/10 bg-card p-6 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <QrCode className="text-accent" size={18} />
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-white">
                {t('vault.receive_funds')}
              </h2>
            </div>
            <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
              <div className="rounded-xl bg-white p-3 self-start">
                <QRCodeSVG value={myAddress} size={140} level="M" includeMargin={false} />
              </div>
              <div className="flex flex-1 flex-col gap-3">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-secondary">
                  {t('vault.receive_address')}
                </p>
                <p className="break-all rounded-xl border border-border/20 bg-surface px-4 py-3 text-sm font-bold text-white">
                  {myAddress}
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-xs font-bold uppercase tracking-[0.15em] text-black"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? t('common.copied') : t('vault.copy_address')}
                  </button>
                </div>
                <p className="text-xs text-secondary">
                  {t('vault.receive_instruction')}
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <AppBottomNav current="wallet" />
    </div>
  );
}






