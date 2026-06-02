import { useState, useEffect } from 'react';
import { Loader2, X, Check, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTransactionQueue, type TxEntry } from '../store/useTransactionQueue';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={12} className="text-secondary" />,
  processing: <Loader2 size={12} className="animate-spin text-accent" />,
  completed: <Check size={12} className="text-green-400" />,
  failed: <AlertCircle size={12} className="text-red-400" />,
};



function TxItem({ entry, onRetry, onRemove }: { entry: TxEntry; onRetry: (id: string) => void; onRemove: (id: string) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-1.5 text-xs">
      {STATUS_ICONS[entry.status]}
      <span className="flex-1 truncate text-white">
        {t(`txType.${entry.type}`, entry.type)}
        {entry.label ? `: ${entry.label}` : ''}
      </span>
      {entry.status === 'failed' && (
        <button onClick={() => onRetry(entry.id)} className="text-accent hover:text-white">
          <RefreshCw size={10} />
        </button>
      )}
      {(entry.status === 'completed' || entry.status === 'failed') && (
        <button onClick={() => onRemove(entry.id)} className="text-secondary hover:text-white">
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export default function TransactionQueueIndicator() {
  const { t } = useTranslation();
  const queue = useTransactionQueue((s) => s.queue);
  const processNext = useTransactionQueue((s) => s.processNext);
  const retry = useTransactionQueue((s) => s.retry);
  const remove = useTransactionQueue((s) => s.remove);
  const clearCompleted = useTransactionQueue((s) => s.clearCompleted);
  const [open, setOpen] = useState(false);

  const pending = queue.filter((e) => e.status === 'pending' || e.status === 'processing').length;
  const failed = queue.filter((e) => e.status === 'failed').length;

  useEffect(() => {
    if (pending > 0) {
      const timer = setInterval(() => { processNext(); }, 2000);
      return () => clearInterval(timer);
    }
  }, [pending, processNext]);

  if (queue.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 z-[100]">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-widest shadow-lg transition-all ${
          failed > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-card text-accent border border-accent/20'
        }`}
      >
        {pending > 0 ? <Loader2 size={10} className="animate-spin" /> : failed > 0 ? <AlertCircle size={10} /> : <Check size={10} />}
        {pending > 0 ? t('transactionQueue.processing', { count: pending }) : failed > 0 ? t('transactionQueue.failed', { count: failed }) : t('transactionQueue.all_complete')}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl bg-card border border-border/20 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/20">
            <span className="text-xs font-bold uppercase tracking-widest text-white">{t('transactionQueue.title')}</span>
            <button
              onClick={clearCompleted}
              className="text-xs text-secondary hover:text-white"
            >
              {t('transactionQueue.clear_completed')}
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {queue.map((entry) => (
              <div key={entry.id}>
                <TxItem entry={entry} onRetry={retry} onRemove={remove} />
                {entry.error && entry.status === 'failed' && (
                  <p className="pl-5 text-xs text-red-400 truncate">{entry.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

