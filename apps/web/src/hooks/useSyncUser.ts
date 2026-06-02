import { useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useAuthStore } from '../store/useAuthStore';
import { api } from '../store/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { resolvePreferredBalance } from '../utils/balance';

type SyncUserData = {
  balance?: string;
  displayName?: string | null;
  wallet: Record<string, any>;
};

export function useSyncUser() {
  const { address, sessionId } = useAuthStore();
  const { setBalance, setUsername } = useUserStore();
  const queryClient = useQueryClient();

  const { data: userData, isLoading } = useQuery<SyncUserData>({
    queryKey: ['user-sync', address, sessionId],
    queryFn: async () => {
      // Read wallet summary from the shared wallet-summary query if already cached
      const cachedWallet = queryClient.getQueryData<any>(['wallet-summary', sessionId]);
      const walletPromise = cachedWallet
        ? Promise.resolve({ data: { data: cachedWallet } })
        : api.get('/api/v1/wallet/summary', { params: { sessionId } }).catch(() => ({ data: { data: {} } }));

      const [walletResult, profileResult] = await Promise.all([
        walletPromise,
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
