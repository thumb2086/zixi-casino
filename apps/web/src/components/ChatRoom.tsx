import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../store/api';

export default function ChatRoom() {
  const [inputText, setInputText] = useState('');
  const { t } = useTranslation();
  const { username } = useUserStore();
  const { isAuthorized } = useAuthStore();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [localMessages, setLocalMessages] = useState<any[]>([]);

  const { data: chatData } = useQuery({
    queryKey: ['chat-messages'],
    queryFn: async () => {
      const res = await api.get('/api/v1/support/chat/messages');
      return res.data.data;
    },
    enabled: isAuthorized,
    refetchInterval: 3000,
  });

  const { sessionId, address } = useAuthStore();

  const messagesLenRef = useRef(0);

  const sendMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await api.post('/api/v1/support/chat/messages', { sessionId, text, displayName: username });
      const payload = res.data;
      if (!payload.success || payload.data?.error) {
        throw new Error(payload.data?.error?.message || payload.data?.error?.code || '發送失敗');
      }
    },
    onMutate: async (text) => {
      const optimisticMsg = {
        id: `temp-${Date.now()}`,
        address,
        displayName: username || '我',
        text,
        createdAt: Date.now(),
      };
      setLocalMessages((prev) => [...prev, optimisticMsg]);
    },
    onSettled: () => {
      // Immediately refetch so real messages arrive quickly
      queryClient.invalidateQueries({ queryKey: ['chat-messages'] });
    },
    onError: (_err) => {
      setLocalMessages((prev) => prev.filter((m) => !m.id.startsWith('temp-')));
    },
  });

  const serverMessages = chatData?.messages || [];
  const messages = useMemo(() => {
    // Deduplicate: remove optimistic messages that have been confirmed by server
    // Match by same text + same sender address + close timestamp (<5s apart)
    const optimistic = localMessages.filter((lm) => {
      if (!lm.id.startsWith('temp-')) return true;
      return !serverMessages.some((sm: any) =>
        sm.text === lm.text &&
        sm.address?.toLowerCase() === lm.address?.toLowerCase() &&
        Math.abs((sm.createdAt || 0) - (lm.createdAt || 0)) < 5000
      );
    });
    return [...serverMessages, ...optimistic];
  }, [serverMessages, localMessages]);

  useEffect(() => {
    // Only auto-scroll when messages grow (new msg), not when they shrink (dedup)
    if (messages.length > messagesLenRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    messagesLenRef.current = messages.length;
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
        {messages.map((m: any) => {
          const isOwn = m.address?.toLowerCase() === address?.toLowerCase();
          return (
            <div key={m.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-3 py-2 ${isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-slate-800 text-slate-200 rounded-bl-sm'}`}>
                {!isOwn && <p className="text-xs font-bold text-yellow-500 mb-0.5">{m.displayName}</p>}
                <p className="text-xs leading-relaxed">{m.text}</p>
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
