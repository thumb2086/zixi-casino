import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useAuthStore';
import { useUserStore } from '../../store/useUserStore';
import { api } from '../../store/api';
import { RefreshCw, ShieldCheck, Globe, LogIn, Fingerprint, QrCode, Monitor, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

export default function LoginView() {
  const { setAuth } = useAuthStore();
  const { setUsername: setGlobalUsername } = useUserStore();
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');
  const [tab, setTab] = useState<'qr' | 'custody'>('qr');
  const [announcements, setAnnouncements] = useState<any[]>([]);

  useEffect(() => {
    api.get('/api/v1/support/announcements')
      .then(res => { if (res.data?.data?.announcements) setAnnouncements(res.data.data.announcements); })
      .catch(() => {});
  }, []);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  // Load saved username and rememberMe preference
  useEffect(() => {
    const savedUsername = sessionStorage.getItem('custody_username');
    const savedRememberMe = sessionStorage.getItem('custody_remember_me');
    if (savedUsername) setUsername(savedUsername);
    if (savedRememberMe === 'true') setRememberMe(true);
  }, []);

  const toggleLanguage = () => {
    i18n.changeLanguage(isZh ? 'en' : 'zh');
  };

  const initSession = async () => {
    setError(null);
    setSessionId(null);
    setDeepLinkUrl(null);
    try {
      const res = await api.post('/api/v1/auth/create-session', { platform: 'web', clientType: 'web' });
      const data = res.data;
      const payload = data?.data;
      const loginLink = payload?.deepLink || payload?.legacyDeepLink;

      if (data.success && payload?.sessionId && loginLink) {
        setSessionId(payload.sessionId);
        setDeepLinkUrl(loginLink);
      } else {
        setError(data.error || "SESSION_CREATION_FAILED");
      }
    } catch (err: any) {
      setError(`CONNECTION_ERROR: ${err.message}`);
    }
  };

  useEffect(() => {
    if (tab === 'qr') initSession();
  }, [tab, retryCount]);

  useEffect(() => {
    if (tab !== 'qr' || !sessionId) return;

    let delay = 3000;
    const poll = () => {
      const timer = setTimeout(() => {
        api.get('/api/v1/auth/status', { params: { sessionId } })
          .then(res => {
            delay = 3000;
            const data = res.data;
            const payload = data?.data;
            if (data.success && payload?.status === 'authorized' && payload?.address) {
              setAuth(payload.address, sessionId, payload.publicKey || '0x');
              if (payload.user?.displayName) setGlobalUsername(payload.user.displayName);
            } else {
              poll();
            }
          })
          .catch(() => {
            delay = Math.min(delay * 2, 10000);
            poll();
          });
      }, delay);
      cleanup = () => clearTimeout(timer);
    };
    let cleanup: (() => void) | null = null;
    poll();
    return () => { if (cleanup) cleanup(); };
  }, [tab, sessionId, setAuth]);

  const handleCustodyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/auth/custody/login', { username, password, platform: 'web', clientType: 'web' });
      const data = res.data;
      const payload = data?.data;
      if (!data.success || !payload?.success || !payload?.sessionId || !payload?.address) {
        setError(data.error || 'LOGIN_FAILED');
      } else {
        // Save remember me preference
        if (rememberMe) {
          sessionStorage.setItem('custody_username', username);
          sessionStorage.setItem('custody_remember_me', 'true');
        } else {
          sessionStorage.removeItem('custody_username');
          sessionStorage.setItem('custody_remember_me', 'false');
        }
        setAuth(payload.address, payload.sessionId, payload.publicKey || '0x');
        setGlobalUsername(payload.user?.displayName || username);
      }
    } catch (err) {
      setError('NETWORK_ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleCustodyRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError(t('auth.error_password_mismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.error_password_too_short'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.post('/api/v1/auth/custody/register', { username, password, platform: 'web', clientType: 'web' });
      const data = res.data;
      const payload = data?.data;
      if (!data.success || !payload?.success || !payload?.sessionId || !payload?.address) {
        setError(data.error || 'REGISTER_FAILED');
      } else {
        // Auto-login after registration
        if (rememberMe) {
          sessionStorage.setItem('custody_username', username);
          sessionStorage.setItem('custody_remember_me', 'true');
        }
        setAuth(payload.address, payload.sessionId, payload.publicKey || '0x');
        setGlobalUsername(payload.user?.displayName || username);
      }
    } catch (err) {
      setError('NETWORK_ERROR');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 font-manrope-emoji text-white selection:bg-accent/30">
      {/* Background Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 blur-[120px] rounded-full" />
      </div>

      {/* Language Toggle */}
      <div className="absolute top-8 right-8 z-50">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleLanguage}
          className="flex items-center gap-3 px-5 py-2.5 bg-card hover:bg-elevated text-accent rounded-xl transition-all border border-accent/20 shadow-lg"
        >
          <Globe size={16} />
          <span className="text-xs font-bold uppercase tracking-widest">{isZh ? t('common.english') : t('common.chinese')}</span>
        </motion.button>
      </div>

      <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 w-full max-w-5xl relative z-10">
        {/* Announcements Panel */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex flex-col w-80 shrink-0"
        >
          <div className="bg-card rounded-2xl border border-border/20 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
               <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-white">
                {t('nav.announcements')}
              </h2>
            </div>
            {announcements.length === 0 ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-surface p-4 border border-border/10">
                  <p className="text-xs font-bold text-white">?? {t('announcement.welcome')}</p>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">
                    {t('announcement.welcome_desc')}
                  </p>
                </div>
                <div className="rounded-xl bg-surface p-4 border border-border/10">
                  <p className="text-xs font-bold text-white">?�� {t('announcement.quick_tips')}</p>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">
                    {t('announcement.tips_desc')}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.filter(a => a.isPinned).map((a: any) => (
                  <div key={a.id} className="rounded-xl bg-accent/5 border border-accent/20 p-4">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-[8px] font-bold bg-accent text-black px-1.5 py-0.5 rounded">{t('announcement.type_urgent')}</span>
                      <p className="text-xs font-bold text-white truncate">{a.title}</p>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{a.content}</p>
                  </div>
                ))}
                {announcements.filter(a => !a.isPinned).slice(0, 3).map((a: any) => (
                  <div key={a.id} className="rounded-xl bg-surface p-4 border border-border/10">
                    <p className="text-xs font-bold text-white">{a.title}</p>
                    <p className="text-xs text-secondary mt-1 line-clamp-2 leading-relaxed">{a.content}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-2 border-t border-border/10">
              <p className="text-[8px] font-bold text-muted uppercase tracking-[0.1em]">
                {t('announcement.more_info')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Mobile announcements banner */}
        {announcements.filter(a => a.isPinned).length > 0 && (
          <div className="lg:hidden w-full max-w-md">
            <div className="bg-accent/5 rounded-xl border border-accent/20 p-3 flex items-start gap-2">
              <span className="text-[8px] font-bold bg-accent text-black px-1.5 py-0.5 rounded shrink-0 mt-0.5">{t('announcement.type_urgent')}</span>
              <p className="text-xs text-secondary leading-relaxed">
                {announcements.filter(a => a.isPinned)[0].title}
              </p>
            </div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-card rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.5)] border border-border/20 p-10 space-y-10 relative overflow-hidden"
        >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#fcc025] to-transparent opacity-40" />

        <header className="text-center space-y-3">
            <motion.div
              initial={{ rotate: -15, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="mx-auto w-20 h-20 bg-elevated rounded-2xl flex items-center justify-center border border-accent/20 shadow-[0_0_30px_rgba(252,192,37,0.1)] mb-6"
            >
                <Fingerprint size={42} className="text-accent" />
            </motion.div>
            <h1 className="text-4xl font-extrabold text-accent tracking-tighter uppercase italic">{t('auth.identity_title')}</h1>
            <p className="text-secondary text-xs font-bold uppercase tracking-[0.15em] leading-relaxed">{t('auth.identity_subtitle')}</p>
        </header>

        <div className="flex bg-surface p-1.5 rounded-xl border border-border/20">
          <button
            onClick={() => setTab('qr')}
            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === 'qr' ? 'bg-accent text-black shadow-lg shadow-[#fcc025]/20' : 'text-secondary hover:text-white'}`}
          >
            {t('auth.qr_login')}
          </button>
          <button
            onClick={() => setTab('custody')}
            className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${tab === 'custody' ? 'bg-accent text-black shadow-lg shadow-[#fcc025]/20' : 'text-secondary hover:text-white'}`}
          >
            {t('auth.custody_login')}
          </button>
        </div>

        <AnimatePresence mode="wait">
          {tab === 'qr' ? (
            <motion.div
              key="qr"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex flex-col items-center space-y-8"
            >
              <div className="relative p-6 bg-gradient-to-br from-[#fcc025] to-[#e6ad03] rounded-3xl shadow-[0_20px_50px_rgba(252,192,37,0.15)] group">
                 {deepLinkUrl ? (
                    <div className="p-3 bg-white rounded-xl group-hover:scale-105 transition-transform duration-500">
                       <QRCodeSVG value={deepLinkUrl} size={176} level="M" />
                    </div>
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center">
                       <div className="w-10 h-10 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
              </div>
              <div className="text-center space-y-2 px-4">
                 <p className="text-secondary text-xs leading-relaxed font-bold uppercase tracking-tight">
                     {t('auth.qr_instruction')}
                 </p>
                 {deepLinkUrl && (
                   <a
                     href={deepLinkUrl}
                     className="inline-flex items-center justify-center mt-2 px-4 py-2 rounded-lg bg-elevated border border-accent/20 text-accent text-xs font-bold uppercase tracking-widest hover:bg-[#2c2c2c] transition-all"
                   >
                     {t('auth.open_app')}
                   </a>
                 )}
                 <div className="flex items-center justify-center gap-2 pt-2">
                     <QrCode size={12} className="text-accent" />
                     <span className="text-xs text-secondary font-bold uppercase tracking-[0.2em]">{t('auth.encrypted_active')}</span>
                 </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="custody"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="space-y-6"
            >
              {/* Login/Register Toggle */}
              <div className="flex bg-surface p-1 rounded-lg border border-border/20">
                <button
                  onClick={() => setMode('login')}
                  className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${mode === 'login' ? 'bg-[#494847] text-white' : 'text-secondary hover:text-white'}`}
                >
                  {t('auth.login')}
                </button>
                <button
                  onClick={() => setMode('register')}
                  className={`flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-widest transition-all ${mode === 'register' ? 'bg-[#494847] text-white' : 'text-secondary hover:text-white'}`}
                >
                  {t('auth.register')}
                </button>
              </div>

              <form onSubmit={mode === 'login' ? handleCustodyLogin : handleCustodyRegister} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-secondary uppercase ml-1 tracking-widest">{t('auth.username')}</label>
                    <div className="relative">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent/40">
                        <Monitor size={16} />
                      </div>
                      <input
                          type="text"
                          value={username}
                          onChange={e => setUsername(e.target.value)}
                          placeholder={t('auth.operator_id_placeholder')}
                          className="w-full bg-surface border border-border/30 rounded-xl pl-14 pr-5 py-4 text-white text-sm focus:border-accent/40 focus:ring-4 focus:ring-[#fcc025]/5 outline-none transition-all placeholder:text-muted font-bold"
                          required
                      />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-secondary uppercase ml-1 tracking-widest">{t('auth.password')}</label>
                    <div className="relative">
                       <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent/40">
                          <Monitor size={16} />
                        </div>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            placeholder={t('auth.password_placeholder')}
                            className="w-full bg-surface border border-border/30 rounded-xl pl-14 pr-5 py-4 text-white text-sm focus:border-accent/40 focus:ring-4 focus:ring-[#fcc025]/5 outline-none transition-all placeholder:text-muted font-bold"
                            required
                        />
                    </div>
                </div>

                {mode === 'register' && (
                  <div className="space-y-2">
                      <label className="text-xs font-bold text-secondary uppercase ml-1 tracking-widest">{t('auth.confirm_password')}</label>
                      <div className="relative">
                         <div className="absolute left-5 top-1/2 -translate-y-1/2 text-accent/40">
                            <Monitor size={16} />
                          </div>
                          <input
                              type="password"
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              placeholder={t('auth.confirm_password_placeholder')}
                              className="w-full bg-surface border border-border/30 rounded-xl pl-14 pr-5 py-4 text-white text-sm focus:border-accent/40 focus:ring-4 focus:ring-[#fcc025]/5 outline-none transition-all placeholder:text-muted font-bold"
                              required
                          />
                      </div>
                  </div>
                )}

                {/* Remember Me Checkbox */}
                <div className="flex items-center gap-3 px-1">
                  <button
                    type="button"
                    onClick={() => setRememberMe(!rememberMe)}
                    className={`flex h-5 w-5 items-center justify-center rounded border transition-all ${
                      rememberMe
                        ? 'border-accent bg-accent'
                        : 'border-border/40 bg-transparent'
                    }`}
                  >
                    {rememberMe && <Check size={14} className="text-black" />}
                  </button>
                  <span className="text-xs font-bold text-secondary">
                    {t('auth.remember_me')}
                  </span>
                </div>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-danger text-xs font-bold text-center bg-[#ff7351]/10 py-4 rounded-xl border border-[#ff7351]/20 uppercase tracking-widest"
                  >
                    {error}
                  </motion.div>
                )}
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-br from-[#fcc025] to-[#e6ad03] text-black font-black py-4 rounded-xl shadow-[0_4px_20px_rgba(252,192,37,0.2)] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden group"
                >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                    <LogIn size={20} className="relative z-10" />
                    <span className="relative z-10 text-xs uppercase italic tracking-tighter">
                      {loading 
                        ? (mode === 'login' ? t('auth.logging_in') : t('auth.registering'))
                        : (mode === 'login' ? t('auth.login_btn') : t('auth.create_account'))
                      }
                    </span>
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pt-8 border-t border-border/10 flex justify-between items-center">
            <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_#fcc025]"></div>
                <span className="text-xs font-bold text-secondary uppercase tracking-[0.2em]">{t('auth.system_ready')}</span>
            </div>
            <motion.button
              whileHover={{ rotate: 180 }}
              transition={{ duration: 0.5 }}
              onClick={() => setRetryCount(c => c + 1)}
              className="p-2.5 text-secondary hover:text-accent transition-colors bg-surface rounded-lg border border-border/20"
            >
                <RefreshCw size={14} />
            </motion.button>
        </div>
      </motion.div>
      </div>

      <p className="mt-12 text-xs font-bold text-muted uppercase tracking-[0.2em] flex items-center gap-3">
          <ShieldCheck size={12} className="text-accent/30" />
          {t('auth.powered_by')}
      </p>
    </div>
  );
}





