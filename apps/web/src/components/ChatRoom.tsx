import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../store/api';

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'https://zixi-casino-api.onrender.com';

export default function ChatRoom() {
  const [inputText, setInputText] = useState('');
  const { t } = useTranslation();
  const { username } = useUserStore();
  const { isAuthorized, sessionId, address } = useAuthStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Load initial messages
  useEffect(() => {
    api.get('/api/v1/support/chat/messages', { params: { limit: 50 } })
      .then((res) => {
        setMessages(res.data.data?.messages || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // SSE stream for real-time updates
  useEffect(() => {
    if (!isAuthorized) return;
    const url = `${API_BASE}/api/v1/support/chat/stream`;
    const source = new EventSource(url);

    source.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [msg, ...prev];
        });
      } catch {}
    };

    source.onerror = () => {
      // Reconnect automatically (EventSource default behavior)
    };

    return () => source.close();
  }, [isAuthorized]);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.post('/api/v1/support/chat/messages', { sessionId, text, displayName: username });
      if (!res.data.success) throw new Error(res.data.data?.error?.message || '發送失敗');
    },
    onError: (_err) => {
      // Message failed to send — SSE won't confirm it either
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex h-[400px] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 p-3">
        <span className="text-xs font-black uppercase tracking-widest text-blue-400">
          {t('chat.title')}
        </span>
        <span className="text-xs text-slate-600">{t('chat.global')}</span>
      </div>

      <div ref={scrollRef} className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-4">
        {loading && (
          <div className="text-xs text-slate-600 text-center py-8">載入中...</div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-xs text-slate-600 text-center py-8">暫無訊息</div>
        )}
        {[...messages].reverse().map((m: any) => {
          const isOwn = m.address?.toLowerCase() === address?.toLowerCase();
          return (
            <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                {!isOwn && <p className="text-xs font-bold text-yellow-500 mb-0.5">{m.displayName}</p>}
                <p className="text-xs leading-relaxed">{m.text}</p>
                {m.createdAt && <p className="text-[9px] text-slate-500 mt-0.5 text-right">{new Date(m.createdAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}</p>}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex gap-2 border-t border-slate-800 bg-slate-950 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!inputText.trim()) return;
          sendMutation.mutate(inputText);
          setInputText('');
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={t('chat.placeholder')}
          className="flex-1 rounded border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white transition-colors focus:border-blue-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-blue-500"
          disabled={sendMutation.isPending}
        >
          {t('chat.send')}
        </button>
      </form>
    </div>
  );
}
