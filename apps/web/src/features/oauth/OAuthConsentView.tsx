import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, Check, X } from 'lucide-react';
import { api } from '../../store/api';
import { useAuthStore } from '../../store/useAuthStore';

export default function OAuthConsentView() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthorized, sessionId } = useAuthStore();

  const clientId = searchParams.get('client_id') || '';
  const redirectUri = searchParams.get('redirect_uri') || '';
  const state = searchParams.get('state') || '';

  const [clientName, setClientName] = useState('');
  const [scopes, setScopes] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!clientId || !redirectUri) {
      setError(t('oauth.invalid_params'));
      setLoading(false);
      return;
    }

    if (!isAuthorized) {
      navigate(`/landing?redirect=/oauth/consent?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}${state ? `&state=${encodeURIComponent(state)}` : ''}`);
      return;
    }

    api.get('/api/v1/oauth/authorize', { params: { client_id: clientId, redirect_uri: redirectUri, response_type: 'code', state, sessionId } })
      .then((res) => {
        const data = res.data?.data;
        if (data?.needsLogin) {
          navigate('/landing');
          return;
        }
        setClientName(data?.clientName || clientId);
        setScopes(data?.scopes || 'profile');
      })
      .catch(() => setError(t('oauth.load_error')))
      .finally(() => setLoading(false));
  }, [clientId, redirectUri, state, isAuthorized, sessionId, navigate, t]);

  const handleApprove = async () => {
    setLoading(true);
    try {
      const res = await api.post('/api/v1/oauth/approve', { client_id: clientId, redirect_uri: redirectUri, state, sessionId });
      const redirectUrl = res.data?.data?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        setError(t('oauth.approve_error'));
      }
    } catch {
      setError(t('oauth.approve_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeny = () => {
    const url = new URL(redirectUri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <Shield className="h-12 w-12 animate-pulse text-accent" />
          <p className="text-sm text-secondary">{t('oauth.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="rounded-2xl border border-danger/20 bg-card p-8 text-center">
          <X className="mx-auto mb-4 h-12 w-12 text-danger" />
          <p className="text-danger">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8">
        <div className="mb-6 text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-accent" />
          <h1 className="section-title section-title-accent text-xl">{t('oauth.authorize_title')}</h1>
        </div>

        <p className="mb-6 text-center text-sm text-secondary">
          {t('oauth.authorize_description', { app: clientName })}
        </p>

        <div className="mb-6 rounded-xl border border-border bg-surface p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-secondary">{t('oauth.this_app_will_get')}</p>
          <ul className="space-y-2">
            {scopes.split(/\s+/).map((scope) => (
              <li key={scope} className="flex items-center gap-2 text-sm text-white">
                <Check className="h-4 w-4 text-success" />
                {t(`oauth.scope.${scope}`, { defaultValue: scope })}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDeny}
            className="flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-secondary transition-colors hover:bg-elevated"
          >
            {t('oauth.deny')}
          </button>
          <button
            onClick={handleApprove}
            disabled={loading}
            className="flex-1 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {t('oauth.approve')}
          </button>
        </div>
      </div>
    </div>
  );
}
