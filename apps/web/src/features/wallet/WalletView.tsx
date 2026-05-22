import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
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
    <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-5 shadow-xl">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-[#adaaaa]">{label}</p>
      <div className="mt-3 flex items-end justify-between">
        <p className="text-3xl font-black italic tracking-tight text-[#fcc025]">{value}</p>
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
      /* ignore — clipboard API may be blocked in some environments */
    }
  };

  const numberMode = amountDisplay === 'full' ? 'full' : 'short';
  const walletSummary = summary.data?.summary;
  const assets = summary.data?.assets;
  const onchain = summary.data?.onchain;
  const canClaimAirdrop = summary.data?.canClaimAirdrop ?? true;
  const nextAirdropAt = summary.data?.nextAirdropAt;
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
  const walletOnlyTotal = (zxcNum + yjcNum * ZXC_PER_YJC).toFixed(4);
  const totalBalance = (Number(walletOnlyTotal) + Number(marketNetWorth || 0)).toFixed(4);

  const nextAirdropLabel = useMemo(() => {
    if (!nextAirdropAt || canClaimAirdrop) return t('vault.airdrop_now');
    return new Date(nextAirdropAt).toLocaleString('zh-TW');
  }, [canClaimAirdrop, nextAirdropAt, t]);

  return (
    <div className="min-h-screen bg-[#0e0e0e] pb-40 font-manrope-emoji text-white">
      <header className="fixed top-0 z-50 w-full border-b border-[#494847]/15 bg-[#0e0e0e]/90 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <WalletIcon className="text-[#fcc025]" />
            <h1 className="text-xl font-extrabold uppercase italic tracking-tight text-[#fcc025]">{t('vault.title')}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/app/shop" className="text-xs font-black uppercase tracking-[0.18em] text-[#fcc025]">
              {t('nav.inventory')}
            </Link>
            <Link to="/app/swap" className="text-xs font-black uppercase tracking-[0.18em] text-[#fcc025]">
              {t('swap.title')}
            </Link>
            <Link to="/app/transactions" className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">
              {t('nav.feed')}
            </Link>
          </div>
        </div>
      </header>

      <main className="app-shell flex flex-col gap-6 pt-24">
        <section className="rounded-[2rem] border border-[#494847]/10 bg-gradient-to-br from-[#1a1919] to-[#0e0e0e] p-8 shadow-[0_0_50px_rgba(252,192,37,0.08)]">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#adaaaa]">{t('vault.total_assets')}</p>
          <p className="mt-4 text-5xl font-black italic tracking-tighter text-[#fcc025]">
            {formatNumber(totalBalance, numberMode)}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 text-xs font-bold uppercase tracking-[0.16em] text-[#adaaaa]">
            <span>{t('vault.wallet')} {formatNumber(walletOnlyTotal, numberMode)}</span>
            <span>{t('market.title')} {formatNumber(marketNetWorth, numberMode)}</span>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <AssetCard label={t('vault.zxc_label')} value={formatNumber(zxcBalance, numberMode)} token="ZXC" />
            <AssetCard label={t('vault.yjc_label')} value={formatNumber(yjcBalance, numberMode)} token={t('wallet.yjc_with_zxc', { amount: formatNumber(yjcNum * ZXC_PER_YJC, numberMode) })} />
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <Gift className="text-[#fcc025]" size={18} />
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white">{t('vault.daily_airdrop')}</h2>
              </div>
              <p className="mt-3 text-sm font-bold text-[#adaaaa]">
                {t('vault.next_available')}{nextAirdropLabel}
              </p>
              <button
                type="button"
                disabled={!canClaimAirdrop || airdrop.isPending}
                onClick={() => airdrop.mutate()}
                className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#fcc025] px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-black disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowDownCircle size={16} />
                {airdrop.isPending ? t('vault.claiming') : t('vault.claim_airdrop')}
              </button>
              {airdrop.error?.message && (
                <p className="mt-2 text-xs font-bold text-[#ff7351]">{airdrop.error.message}</p>
              )}
            </div>

            <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
              <div className="flex items-center gap-3">
                <Repeat2 className="text-[#fcc025]" size={18} />
                <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white">{t('vault.transfer')}</h2>
              </div>
              <div className="mt-4 grid gap-3">
                <input
                  value={transferTo}
                  onChange={(event) => setTransferTo(event.target.value)}
                  placeholder={t('vault.recipient_placeholder')}
                  className="rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none focus:border-[#fcc025]/40"
                />
                <div className="grid gap-3 md:grid-cols-[1fr_140px]">
                  <input
                    value={transferAmount}
                    onChange={(event) => setTransferAmount(event.target.value)}
                    placeholder={t('market.amount')}
                    className="rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none focus:border-[#fcc025]/40"
                  />
                  <select
                    value={transferToken}
                    onChange={(event) => setTransferToken(event.target.value as 'zhixi' | 'yjc')}
                    className="rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold outline-none"
                  >
                    <option value="zhixi">ZXC</option>
                    <option value="yjc">YJC</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!transferTo || !transferAmount || transfer.isPending}
                  onClick={() => transfer.mutate({ to: transferTo, amount: transferAmount, token: transferToken })}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-black disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ArrowUpCircle size={16} />
                  {transfer.isPending ? t('vault.sending') : t('vault.send_transfer')}
                </button>
              </div>
            </div>

            {myAddress && (
              <div className="rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl">
                <div className="flex items-center gap-3">
                  <QrCode className="text-[#fcc025]" size={18} />
                  <h2 className="text-xs font-black uppercase tracking-[0.18em] text-white">
                    {t('vault.receive_funds')}
                  </h2>
                </div>
                <div className="mt-4 flex flex-col items-stretch gap-4 md:flex-row md:items-center">
                  <div className="rounded-xl bg-white p-3 self-start">
                    <QRCodeSVG value={myAddress} size={160} level="M" includeMargin={false} />
                  </div>
                  <div className="flex flex-1 flex-col gap-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">
                      {t('vault.receive_address')}
                    </p>
                    <p className="break-all rounded-xl border border-[#494847]/20 bg-[#0e0e0e] px-4 py-3 text-sm font-bold text-white">
                      {myAddress}
                    </p>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#fcc025] px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-black"
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? t('common.copied') : t('vault.copy_address')}
                    </button>
                    <p className="text-xs text-[#adaaaa]">
                      {t('vault.receive_instruction')}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </div>

          <Link to="/app/transactions" className="flex items-center justify-between rounded-2xl border border-[#494847]/10 bg-[#1a1919] p-6 shadow-2xl hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-2">
              <History size={16} className="text-[#adaaaa]" />
              <h2 className="text-xs font-black uppercase tracking-[0.18em] text-[#adaaaa]">交易紀錄</h2>
            </div>
            <ChevronRight size={16} className="text-[#adaaaa]" />
          </Link>
        </section>
      </main>

      <AppBottomNav current="wallet" />
    </div>
  );
}
