import { useState, useEffect } from 'react';
import { Loader2, X, Check, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { useTransactionQueue, type TxEntry } from '../store/useTransactionQueue';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock size={12} className="text-[#adaaaa]" />,
  processing: <Loader2 size={12} className="animate-spin text-[#fcc025]" />,
  completed: <Check size={12} className="text-green-400" />,
  failed: <AlertCircle size={12} className="text-red-400" />,
};

const TYPE_LABELS: Record<string, string> = {
  bet: '下注',
  chest_open: '開寶箱',
  transfer: '轉帳',
  item_use: '使用物品',
  convert: '兌換',
  buy: '購買',
};

function TxItem({ entry, onRetry, onRemove }: { entry: TxEntry; onRetry: (id: string) => void; onRemove: (id: string) => void }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-[11px]">
      {STATUS_ICONS[entry.status]}
      <span className="flex-1 truncate text-white">
        {TYPE_LABELS[entry.type] || entry.type}
        {entry.label ? `: ${entry.label}` : ''}
      </span>
      {entry.status === 'failed' && (
        <button onClick={() => onRetry(entry.id)} className="text-[#fcc025] hover:text-white">
          <RefreshCw size={10} />
        </button>
      )}
      {(entry.status === 'completed' || entry.status === 'failed') && (
        <button onClick={() => onRemove(entry.id)} className="text-[#adaaaa] hover:text-white">
          <X size={10} />
        </button>
      )}
    </div>
  );
}

export default function TransactionQueueIndicator() {
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
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest shadow-lg transition-all ${
          failed > 0 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#1a1919] text-[#fcc025] border border-[#fcc025]/20'
        }`}
      >
        {pending > 0 ? <Loader2 size={10} className="animate-spin" /> : failed > 0 ? <AlertCircle size={10} /> : <Check size={10} />}
        {pending > 0 ? `${pending} 處理中` : failed > 0 ? `${failed} 失敗` : '全部完成'}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-72 rounded-xl bg-[#1a1919] border border-[#494847]/20 shadow-2xl p-3">
          <div className="flex items-center justify-between mb-2 pb-2 border-b border-[#494847]/20">
            <span className="text-[10px] font-black uppercase tracking-widest text-white">交易佇列</span>
            <button
              onClick={clearCompleted}
              className="text-[10px] text-[#adaaaa] hover:text-white"
            >
              清除已完成
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {queue.map((entry) => (
              <div key={entry.id}>
                <TxItem entry={entry} onRetry={retry} onRemove={remove} />
                {entry.error && entry.status === 'failed' && (
                  <p className="pl-5 text-[10px] text-red-400 truncate">{entry.error}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
