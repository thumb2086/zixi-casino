import { useEffect, useState, FormEvent } from 'react';
import { LifeBuoy, Send, Megaphone, MessageCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AppBottomNav from '../../components/AppBottomNav';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';

interface Announcement {
  id: string;
  title: string;
  content: string;
  isPinned?: boolean;
  publishedAt?: string;
}

interface ChatMessage {
  id: string;
  displayName?: string;
  address?: string;
  text: string;
  createdAt?: string;
}

const CATEGORIES = (t: (key: string) => string) => [
  { value: 'bug', label: t('support.cat_bug') },
  { value: 'account', label: t('support.cat_account') },
  { value: 'payment', label: t('support.cat_payment') },
  { value: 'gameplay', label: t('support.cat_gameplay') },
  { value: 'other', label: t('support.cat_other') },
];

export default function SupportView() {
  const { t } = useTranslation();
  const { sessionId, isAuthorized } = useAuthStore();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('bug');
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<string | null>(null);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatSending, setChatSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await api.get('/api/v1/support/announcements');
        if (!cancelled) {
          setAnnouncements(res.data?.data?.announcements || []);
        }
      } finally {
        if (!cancelled) setAnnouncementsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ticketResult) { const t = setTimeout(() => setTicketResult(null), 3000); return () => clearTimeout(t); }
  }, [ticketResult]);

  useEffect(() => {
    let cancelled = false;
    async function loadChat() {
      setChatLoading(true);
      try {
        const res = await api.get('/api/v1/support/chat/messages');
        if (!cancelled) {
          setChatMessages(res.data?.data?.messages || []);
        }
      } finally {
        if (!cancelled) setChatLoading(false);
      }
    }
    loadChat();
    const id = setInterval(loadChat, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  async function handleSubmitTicket(e: FormEvent) {
    e.preventDefault();
    if (!sessionId) {
      setTicketResult(t('support.login_first'));
      return;
    }
    if (!title.trim() || !message.trim()) {
      setTicketResult(t('support.fill_required'));
      return;
    }
    setSubmitting(true);
    setTicketResult(null);
    try {
      const res = await api.post('/api/v1/support/tickets', {
        sessionId,
        title: title.trim(),
        category,
        message: message.trim(),
        contact: contact.trim() || undefined,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
      });
      const data = res.data?.data;
      if (data?.success) {
        setTicketResult(t('support.ticket_created', { id: data.reportId }));
        setTitle('');
        setMessage('');
        setContact('');
      } else {
        setTicketResult(res.data?.data?.error?.message || t('support.ticket_failed'));
      }
    } catch (err: any) {
      setTicketResult(err?.response?.data?.data?.error?.message || err?.message || t('support.ticket_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendChat(e: FormEvent) {
    e.preventDefault();
    if (!sessionId || !chatText.trim()) return;
    setChatSending(true);
    try {
      await api.post('/api/v1/support/chat/messages', {
        sessionId,
        text: chatText.trim(),
      });
      setChatText('');
      const res = await api.get('/api/v1/support/chat/messages');
      setChatMessages(res.data?.data?.messages || []);
    } catch {
      // swallow; user will see stale list
    } finally {
      setChatSending(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border/15">
        <div className="flex items-center justify-between px-6 py-4 ">
          <div className="flex items-center gap-4">
            <LifeBuoy className="text-accent" />
            <h1 className="font-extrabold tracking-tight text-xl text-accent uppercase italic">{t('support.title')}</h1>
          </div>
        </div>
      </header>

      <main className="pt-24 px-6 space-y-8">
        <section className="bg-card rounded-2xl p-6 border border-border/20">
          <div className="flex items-center gap-2 mb-4">
            <Megaphone size={18} className="text-accent" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('support.announcements_title')}</h2>
          </div>
          {announcementsLoading ? (
            <div className="flex items-center gap-2 text-secondary text-sm"><Loader2 size={14} className="animate-spin" /> {t('support.loading')}</div>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-secondary">{t('support.no_announcements')}</p>
          ) : (
            <ul className="space-y-3">
              {announcements.slice(0, 3).map((a) => (
                <li key={a.id} className="border-l-2 border-accent/50 pl-3">
                  <div className="flex items-center gap-2">
                    {a.isPinned && <span className="text-xs font-black uppercase text-accent">{t('support.pinned')}</span>}
                    <h3 className="text-sm font-bold text-white">{a.title}</h3>
                  </div>
                  <p className="text-xs text-secondary mt-1 whitespace-pre-wrap">{a.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-card rounded-2xl p-6 border border-border/20">
          <div className="flex items-center gap-2 mb-4">
            <Send size={18} className="text-accent" />
            <h2 className="text-sm font-black uppercase tracking-widest text-white">{t('support.submit_ticket_title')}</h2>
          </div>
          {!isAuthorized ? (
            <p className="text-sm text-secondary">{t('support.login_first')}</p>
          ) : (
            <form onSubmit={handleSubmitTicket} className="space-y-3">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-secondary mb-1">{t('support.title_label')}</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm focus:border-accent/50 focus:outline-none"
                  placeholder={t('support.title_placeholder')}
                  maxLength={100}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-secondary mb-1">{t('support.category_label')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm focus:border-accent/50 focus:outline-none"
                >
                  {CATEGORIES(t).map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-secondary mb-1">{t('support.content_label')}</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm focus:border-accent/50 focus:outline-none min-h-24"
                  placeholder={t('support.content_placeholder')}
                  maxLength={2000}
                />
              </div>
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-secondary mb-1">{t('support.contact_label')}</label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full bg-surface border border-border/30 rounded-lg px-3 py-2 text-sm focus:border-accent/50 focus:outline-none"
                  placeholder={t('support.contact_placeholder')}
                  maxLength={200}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-accent text-[#0e0e0e] font-black uppercase tracking-widest text-xs py-3 rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {t('support.submit_btn')}
              </button>
              {ticketResult && (
                <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-card border border-accent/40 shadow-lg shadow-black/50 text-sm font-bold text-white animate-[fadeIn_0.3s_ease-out] whitespace-nowrap">
                  {ticketResult}
                </div>
              )}
            </form>
          )}
        </section>


      </main>

      <AppBottomNav current="none" />
    </div>
  );
}
