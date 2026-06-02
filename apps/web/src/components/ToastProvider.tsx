import { useToastStore } from '../store/useToastStore';

export default function ToastProvider() {
  const { toasts, removeToast } = useToastStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => removeToast(t.id)}
          className={`pointer-events-auto cursor-pointer rounded-xl px-5 py-3 text-xs font-bold shadow-lg transition-all duration-300 ${
            t.type === 'success' ? 'bg-emerald-600 text-white' :
            t.type === 'error' ? 'bg-red-600 text-white' :
            'bg-card text-white border border-border/40'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
