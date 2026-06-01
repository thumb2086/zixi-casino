import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { api } from './store/api';
import LoginView from './features/auth/LoginView';
import LobbyView from './features/casino/LobbyView';
import LandingView from './features/landing/LandingView';
import SoundPlayer from './components/SoundPlayer';
import TransactionQueueIndicator from './components/TransactionQueueIndicator';
import { useAuthStore } from './store/useAuthStore';
import { useUserStore } from './store/useUserStore';
import { useSyncUser } from './hooks/useSyncUser';
import Layout from './components/Layout';

// Lazy-loaded pages
const CasinoView = lazy(() => import('./features/casino/CasinoView'));
const WalletView = lazy(() => import('./features/wallet/WalletView'));
const SwapView = lazy(() => import('./features/wallet/SwapView'));
const MarketView = lazy(() => import('./features/market/MarketView'));
const RewardsView = lazy(() => import('./features/rewards/RewardsView'));
const SubmitRewardView = lazy(() => import('./features/rewards/SubmitRewardView'));
const AdminView = lazy(() => import('./features/admin/AdminView'));
const ChestView = lazy(() => import('./features/inventory/ChestView'));
const LeaderboardView = lazy(() => import('./features/stats/LeaderboardView'));
const RoomLobbyView = lazy(() => import('./features/casino/RoomLobbyView'));
const SupportView = lazy(() => import('./features/support/SupportView'));
const ProfileSetup = lazy(() => import('./features/profile/ProfileSetup'));
const AnnouncementCenter = lazy(() => import('./features/announcement/AnnouncementCenter'));
const SettingsView = lazy(() => import('./features/settings/SettingsView'));
const ShopView = lazy(() => import('./features/shop/ShopView'));
const TransactionsDashboardView = lazy(() => import('./features/dashboard/TransactionsDashboardView'));
const VIPLevelsView = lazy(() => import('./features/info/VIPLevelsView'));
const InfoView = lazy(() => import('./features/info/InfoView'));
const CompanyView = lazy(() => import('./features/company/CompanyView'));
const PerformanceView = lazy(() => import('./features/stats/PerformanceView'));
const PokerRoomView = lazy(() => import('./features/casino/PokerRoomView'));
const BluffDiceRoomView = lazy(() => import('./features/casino/BluffDiceRoomView'));
import { Loader2 } from 'lucide-react';
import { useFontSizeStore } from './store/useFontSizeStore';

const queryClient = new QueryClient();

// 快速登入：直接 call /auth/me 驗證 session + 取得使用者資料（省去一次 round trip）
function useFastLogin() {
  const { sessionId, setAuth, clearAuth } = useAuthStore();
  const { setAddress, setBalance, setUsername, setActiveAvatar, setActiveTitle } = useUserStore();
  const [isRestoring, setIsRestoring] = useState(true);
  const restoredRef = useRef(false);

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      restoredRef.current = true;
      setIsRestoring(false);
      return;
    }

    // First run (page load with persisted session): clear stale session if !rememberMe
    if (!restoredRef.current) {
      restoredRef.current = true;
      const rememberMe = localStorage.getItem('custody_remember_me') === 'true';
      if (!rememberMe) {
        clearAuth();
        setIsRestoring(false);
        return;
      }
    }

    const startTime = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);

    api.get('/api/v1/auth/me', { params: { sessionId } })
      .then((res) => {
        const data = res.data;
        const payload = data?.data;

        if (data.success && payload?.address) {
          setAuth(payload.address, sessionId, payload.publicKey || '0x');
          setAddress(payload.address);
          if (payload.balance) setBalance(payload.balance);
          if (payload.user?.displayName) setUsername(payload.user.displayName);
          else if (payload.username) setUsername(payload.username);
          if (payload.activeAvatar) setActiveAvatar(payload.activeAvatar);
          if (payload.activeTitle) setActiveTitle(payload.activeTitle);
        } else {
          clearAuth();
        }
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        clearInterval(timer);
        setIsRestoring(false);
      });

    return () => clearInterval(timer);
  }, [sessionId, setAuth, clearAuth, setAddress, setBalance, setUsername, setActiveAvatar, setActiveTitle]);

  return { isRestoring, elapsed };
}

function FontSizeApplier() {
  const fontSize = useFontSizeStore((s) => s.fontSize);
  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
  }, [fontSize]);
  return null;
}

// Keep-alive ping to prevent Render from spinning down
function useKeepAlive() {
  useEffect(() => {
    const ping = () => { api.get('/health').catch(() => {}); };
    ping();
    const interval = setInterval(ping, 4 * 60 * 1000); // every 4 minutes
    return () => clearInterval(interval);
  }, []);
}

function AppContent() {
  useKeepAlive();
  const { isAuthorized } = useAuthStore();
  const { isRestoring, elapsed } = useFastLogin();
  useSyncUser();

  if (isRestoring) {
    return (
      <div className="relative min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#fcc025]" />
          <p className="text-sm text-[#adaaaa]">正在恢復登入狀態{elapsed > 0 ? ` (${elapsed}秒)` : '...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#0e0e0e]">
      <FontSizeApplier />
      <SoundPlayer />
      {isAuthorized && <TransactionQueueIndicator />}
      <Routes>
        <Route path="/landing" element={<LandingView />} />
        {!isAuthorized ? (
          <>
            <Route path="/" element={<Navigate to="/landing" replace />} />
            <Route path="*" element={<LoginView />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Navigate to="/app" replace />} />
            <Route path="/app" element={<Layout />}>
              <Route path="performance" element={<PerformanceView />} />
              <Route index element={<LobbyView />} />
              <Route path="casino/:game" element={<CasinoView />} />
              <Route path="casino/lobby" element={<RoomLobbyView />} />
              <Route path="wallet" element={<WalletView />} />
              <Route path="swap" element={<SwapView />} />
              <Route path="shop" element={<ShopView />} />
              <Route path="market" element={<MarketView />} />
              <Route path="rewards" element={<RewardsView />} />
              <Route path="rewards/submit" element={<SubmitRewardView />} />
              <Route path="events" element={<AnnouncementCenter />} />
              <Route path="leaderboard" element={<LeaderboardView />} />
              <Route path="announcement" element={<AnnouncementCenter />} />
              <Route path="support" element={<SupportView />} />
              <Route path="inventory" element={<ChestView />} />
              <Route path="collection" element={<Navigate to="/app/inventory" replace />} />
              <Route path="admin" element={<AdminView />} />
              <Route path="settings" element={<SettingsView />} />
              <Route path="profile/setup" element={<ProfileSetup onComplete={() => window.location.reload()} />} />
              <Route path="transactions" element={<Navigate to="/app/announcement" replace />} />
              <Route path="dashboard/transactions" element={<TransactionsDashboardView />} />
              <Route path="info/vip-levels" element={<VIPLevelsView />} />
              <Route path="info/odds" element={<Navigate to="/app/info?tab=odds" replace />} />
              <Route path="info" element={<InfoView />} />
              <Route path="company" element={<CompanyView />} />
            </Route>
          </>
        )}
      </Routes>
    </div>
  );
}

function App() {
    return (
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <Router>
                    <AppContent />
                </Router>
            </QueryClientProvider>
        </HelmetProvider>
    );
}

export default App;
