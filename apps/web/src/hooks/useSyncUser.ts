import { useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../store/api';
import { useQuery } from '@tanstack/react-query';
import { resolvePreferredBalance } from '../utils/balance';

type SyncUserData = {
  balance?: string;
  displayName?: string | null;
  wallet: Record<string, any>;
};

export function useSyncUser() {
  const { address, sessionId } = useAuthStore();
  const { setBalance, setUsername } = useUserStore();

  const { data: userData, isLoading } = useQuery<SyncUserData>({
    queryKey: ['user-wallet', address, sessionId],
    queryFn: async () => {
      const [walletResult, profileResult] = await Promise.all([
        api.get('/api/v1/wallet/summary', { params: { sessionId } }).catch(() => ({ data: { data: {} } })),
        api.get('/api/v1/me/profile', { params: { sessionId } }).catch(() => ({ data: { data: {} } })),
      ]);

      const walletData = walletResult.data?.data || {};

      const walletBalance = resolvePreferredBalance({
        onchainBalance: walletData?.onchain?.zxc?.balance,
        onchainAvailable: walletData?.onchain?.zxc?.available,
        walletBalance: walletData?.summary?.balances?.ZXC,
      });

      const displayName = profileResult.data?.data?.profile?.displayName;

      return {
        wallet: walletData,
        balance: walletBalance,
        displayName,
      } as SyncUserData;
    },
    enabled: !!sessionId,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (userData?.balance) {
      setBalance(userData.balance);
    }
    if (userData?.displayName) {
      setUsername(userData.displayName);
    }
  }, [userData, setBalance, setUsername]);

  return { userData, isLoading };
}
