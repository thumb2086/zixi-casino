import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, useRef } from 'react';
import { api } from './store/api';
import CasinoView from './features/casino/CasinoView';
import WalletView from './features/wallet/WalletView';
import SwapView from './features/wallet/SwapView';
import LoginView from './features/auth/LoginView';
import { useAuthStore } from './store/useAuthStore';
import { useUserStore } from './store/useUserStore';
import MarketView from './features/market/MarketView';
import RewardsView from './features/rewards/RewardsView';
import SubmitRewardView from './features/rewards/SubmitRewardView';
import AdminView from './features/admin/AdminView';
import ChestView from './features/inventory/ChestView';
import LeaderboardView from './features/stats/LeaderboardView';

import RoomLobbyView from './features/casino/RoomLobbyView';
import LobbyView from './features/casino/LobbyView';
import SupportView from './features/support/SupportView';
import ProfileSetup from './features/profile/ProfileSetup';
import AnnouncementCenter from './features/announcement/AnnouncementCenter';
import SettingsView from './features/settings/SettingsView';
import ShopView from './features/shop/ShopView';
import TransactionsDashboardView from './features/dashboard/TransactionsDashboardView';
import SoundPlayer from './components/SoundPlayer';
import TransactionQueueIndicator from './components/TransactionQueueIndicator';
import { useSyncUser } from './hooks/useSyncUser';
import Layout from './components/Layout';
import VIPLevelsView from './features/info/VIPLevelsView';
import InfoView from './features/info/InfoView';
import CompanyView from './features/company/CompanyView';
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
        {!isAuthorized ? (
          <Route path="*" element={<LoginView />} />
        ) : (
          <Route path="/app" element={<Layout />}>
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
        )}
        {isAuthorized && <Route path="/" element={<Navigate to="/app" replace />} />}
      </Routes>
    </div>
  );
}

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <Router>
                <AppContent />
            </Router>
        </QueryClientProvider>
    );
}

export default App;
