import { Activity, Server, Users, Clock, Database, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../store/api';
import AppBottomNav from '../../components/AppBottomNav';

export default function PerformanceView() {
  const { t } = useTranslation();

  const { data: perfData, isLoading } = useQuery({
    queryKey: ['performance-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/performance');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const { data: healthData } = useQuery({
    queryKey: ['health-stats-inline'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/health');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const stats = healthData?.stats;

  const metrics = [
    { icon: Clock, label: '伺服器運行', value: perfData?.uptimeLabel || '...', color: 'text-emerald-400' },
    { icon: Users, label: '註冊用戶', value: perfData?.users?.toLocaleString() || '...', color: 'text-info' },
    { icon: Activity, label: '活躍連線', value: perfData?.activeSessions?.toLocaleString() || '...', color: 'text-accent' },
    { icon: Database, label: '24h 交易數', value: perfData?.tx24h?.toLocaleString() || '...', color: 'text-warning' },
    { icon: Server, label: 'UPTIME', value: stats?.uptime ?? '...', color: 'text-emerald-400' },
    { icon: Zap, label: '失敗率', value: stats?.failureRate ?? '...', color: stats?.failureRate && parseFloat(stats.failureRate) > 5 ? 'text-danger' : 'text-accent' },
  ];

  return (
    <div className="min-h-screen bg-surface text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border/15">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
            <Activity className="text-accent" />
            <h1 className="font-extrabold tracking-tight text-xl text-accent uppercase italic">效能監控</h1>
          </div>
        </div>
      </header>

      <main className="app-shell pt-24">
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {metrics.map((m) => (
            <div key={m.label} className="bg-card p-5 rounded-2xl border border-border/10 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <m.icon size={14} className={m.color} />
                <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">{m.label}</span>
              </div>
              <span className={`text-lg font-black italic ${m.color}`}>{String(m.value)}</span>
            </div>
          ))}
        </section>

        {stats?.nodes && (
          <section className="bg-card rounded-2xl p-6 border border-border/10">
            <h2 className="text-xs font-black uppercase tracking-widest text-secondary mb-4">節點狀態</h2>
            <div className="text-sm text-white font-bold">{stats.nodes}</div>
          </section>
        )}

        {stats?.logs && stats.logs.length > 0 && (
          <section className="bg-card rounded-2xl p-6 border border-border/10 mt-6">
            <h2 className="text-xs font-black uppercase tracking-widest text-secondary mb-4">近期事件</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {stats.logs.slice(0, 20).map((log: any, i: number) => (
                <div key={i} className="text-xs text-secondary border-b border-border/10 pb-1 last:border-0">
                  <span className="text-muted">{new Date(log.createdAt).toLocaleString('zh-TW')}</span>
                  {' '}{log.message || log.type || ''}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}