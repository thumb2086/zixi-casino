import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { User, ArrowRight, ShieldCheck, Fingerprint } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../store/api';

const ERROR_KEYS: Record<string, string> = {
  USERNAME_TOO_SHORT: 'profile.name_length_error',
  SAVE_FAILED: 'profile.name_update_failed',
  NETWORK_ERROR: 'common.network_error',
};

export default function ProfileSetup({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const { sessionId } = useAuthStore();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (username.length < 2) {
      setError('USERNAME_TOO_SHORT');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/profile/set-username', { sessionId, username });
      const data = res.data;
      if (data.success) {
        onComplete();
      } else {
        setError(data.error || 'SAVE_FAILED');
      }
    } catch (err) {
      setError('NETWORK_ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-manrope-emoji text-white selection:bg-accent/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-card rounded-2xl p-10 shadow-[0_0_50px_rgba(252,192,37,0.05)] border border-border/10 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#fcc025] to-transparent opacity-50" />

        <div className="flex flex-col items-center text-center space-y-8 relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="w-20 h-20 bg-elevated rounded-2xl flex items-center justify-center border border-accent/20 shadow-[0_0_20px_rgba(252,192,37,0.1)]"
          >
            <Fingerprint size={40} className="text-accent" />
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-3xl font-extrabold text-accent tracking-tighter uppercase italic">{t('profile.identity_sync')}</h1>
            <p className="text-secondary font-bold uppercase text-xs tracking-[0.1em] leading-relaxed">{t('profile.sync_instruction')}</p>
          </div>

          <form onSubmit={handleSave} className="w-full space-y-6 pt-4">
            <div className="space-y-2 text-left">
              <label className="text-xs uppercase tracking-[0.2em] text-secondary font-bold ml-1">{t('profile.operator_id')}</label>
              <div className="relative">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent/40">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder={t('profile.nickname_placeholder')}
                  className="w-full bg-surface border border-border/20 rounded-xl pl-14 pr-6 py-5 text-white text-lg focus:border-accent/50 focus:ring-4 focus:ring-[#fcc025]/5 outline-none transition-all placeholder:text-muted font-bold tracking-tight"
                  maxLength={20}
                  required
                />
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-danger text-xs font-bold bg-[#ff7351]/10 py-4 px-4 rounded-xl border border-[#ff7351]/20 uppercase tracking-widest flex items-center gap-3"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff7351] animate-pulse" />
                {t(ERROR_KEYS[error] || error)}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-[#fcc025] to-[#e6ad03] text-black font-black py-5 rounded-xl shadow-[0_4px_20px_rgba(252,192,37,0.2)] hover:shadow-[0_4px_25px_rgba(252,192,37,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 group overflow-hidden relative"
            >
              <span className="text-sm uppercase italic tracking-tighter relative z-10">{loading ? t('profile.saving') : t('profile.save_continue')}</span>
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform relative z-10" />
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            </button>
          </form>

          <div className="pt-4 flex items-center gap-2 opacity-30">
            <ShieldCheck size={14} className="text-secondary" />
            <span className="text-[8px] font-bold uppercase tracking-[0.15em] text-secondary">{t('profile.secure_protocol')}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

