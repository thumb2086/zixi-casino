import {
  Activity,
  Terminal,
  HeartPulse,
  Database
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../store/api';
import AppBottomNav from '../../components/AppBottomNav';

export default function HealthView() {
  const { t } = useTranslation();

  const { data: healthData, isLoading } = useQuery({
    queryKey: ['health-stats'],
    queryFn: async () => {
      const res = await api.get('/api/v1/stats/health');
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  const stats = healthData?.stats;
  const recentLogs = healthData?.logs || [];

  return (
    <div className="min-h-screen bg-surface text-white font-manrope-emoji pb-32">
      <header className="fixed top-0 w-full z-50 bg-surface/90 backdrop-blur-xl border-b border-border/20">
        <div className="app-shell flex items-center justify-between py-4">
          <div className="flex items-center gap-4">
             <HeartPulse className="text-accent" />
             <h1 className="font-extrabold tracking-tight text-xl text-accent uppercase italic">{t('settings.service_status')}</h1>
          </div>
        </div>
      </header>

      <main className="app-shell space-y-10 pt-24">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <div className="bg-card p-6 rounded-2xl border border-border/10 flex flex-col gap-2">
              <span className="text-[8px] font-bold text-muted uppercase tracking-[0.1em]">UPTIME</span>
              <span className="text-xl font-black italic text-emerald-500">{stats?.uptime ?? (isLoading ? '...' : '--')}</span>
           </div>
           <div className="bg-card p-6 rounded-2xl border border-border/10 flex flex-col gap-2">
              <span className="text-[8px] font-bold text-muted uppercase tracking-[0.1em]">FAILURE RATE</span>
              <span className="text-xl font-black italic text-accent">{stats?.failureRate ?? (isLoading ? '...' : '--')}</span>
           </div>
           <div className="bg-card p-6 rounded-2xl border border-border/10 flex flex-col gap-2">
              <span className="text-[8px] font-bold text-muted uppercase tracking-[0.1em]">NODES</span>
              <span className="text-xl font-black italic text-white">{stats?.nodes ?? (isLoading ? '...' : '--')}</span>
           </div>
           <div className="bg-card p-6 rounded-2xl border border-border/10 flex flex-col gap-2">
              <span className="text-[8px] font-bold text-muted uppercase tracking-[0.1em]">SECURE LAYER</span>
              <span className="text-xl font-black italic text-accent">{stats?.secureLayer ?? '--'}</span>
           </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           <section className="bg-card rounded-2xl p-8 border border-border/10 space-y-8">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Activity size={16} className="text-accent" />
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">SIMULATION THROUGHPUT</h3>
                 </div>
                 <div className="flex items-center gap-4 text-[8px] font-bold uppercase">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500/20 border border-emerald-500" /> SUCCESS</div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-red-500/60 border border-red-500" /> FAILURE</div>
                 </div>
              </div>
              <div className="flex items-end gap-1.5 h-48">
                 {stats?.last24h?.success?.length > 0 ? (
                   stats.last24h.success.map((val: number, i: number) => (
                    <div key={i} className="flex-1 group relative">
                       <div className="bg-emerald-500/10 w-full rounded-t-sm" style={{ height: `${(val/50)*100}%` }} />
                       <div className="bg-red-500/40 w-full rounded-t-sm -mt-1" style={{ height: `${(stats.last24h.failure[i]/50)*100}%` }} />
                    </div>
                   ))
                 ) : isLoading ? (
                   <div className="w-full h-full flex items-center justify-center">
                     <span className="text-muted text-xs">Loading...</span>
                   </div>
                 ) : (
                   <div className="w-full h-full flex flex-col items-center justify-center opacity-30">
                     <Activity size={32} className="text-muted mb-2" />
                     <span className="text-muted text-xs font-bold uppercase">No Data Available</span>
                   </div>
                 )}
              </div>
              <div className="flex justify-between text-[8px] font-bold text-muted uppercase tracking-[0.1em]">
                 <span>24 HOURS AGO</span>
                 <span>SYNCHRONIZED NOW</span>
              </div>
           </section>

           <section className="bg-card rounded-2xl p-8 border border-border/10 space-y-6">
              <div className="flex items-center gap-2">
                 <Terminal size={16} className="text-accent" />
                 <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">SYSTEM EVENTS</h3>
              </div>
              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-4 hide-scrollbar">
                 {recentLogs.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-20 opacity-20 space-y-4">
                      <Database size={40} />
                      <p className="text-xs font-bold uppercase tracking-[0.2em]">No recent traces detected</p>
                   </div>
                 )}
                 {recentLogs.map((ev: any, i: number) => (
                    <div key={ev.id || i} className="bg-surface rounded-xl p-4 border border-border/10 space-y-2 group hover:border-accent/30 transition-all">
                       <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm ${ev.severity === 'error' || ev.severity === 'fatal' ? 'bg-red-500/10 text-red-500' : ev.severity === 'warn' ? 'bg-amber-500/10 text-amber-400' : 'bg-accent/10 text-accent'}`}>[{ev.kind}]</span>
                          <span className="text-[8px] font-bold text-muted">{new Date(ev.createdAt).toLocaleTimeString([], { hour12: false })}</span>
                       </div>
                       <p className="text-xs font-bold text-white leading-relaxed uppercase italic tracking-tight">{ev.message}</p>
                    </div>
                 ))}
              </div>
           </section>
        </div>
      </main>

      <AppBottomNav current="none" />
    </div>
  );
}



