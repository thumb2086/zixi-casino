// Shared game result handler — instant balance update + correct query invalidation
import { useUserStore } from '../../store/useUserStore';

export function useGameResultHandler() {
  const setBalance = useUserStore((s) => s.setBalance);

  /**
   * Call after ANY game bet success to:
   * 1. Immediately update displayed balance (no 60s wait)
   * 2. Invalidate all relevant query caches
   */
  function onBetSuccess(data: any, queryClient: any) {
    // Immediately update Zustand balance if API returned it
    if (data?.balance !== undefined && data.balance !== null) {
      setBalance(String(data.balance));
    }

    // Invalidate all balance-related queries
    queryClient.invalidateQueries({ queryKey: ['wallet-summary'] });
    queryClient.invalidateQueries({ queryKey: ['user-sync'] });
    queryClient.invalidateQueries({ queryKey: ['user'] });
    queryClient.invalidateQueries({ queryKey: ['my-profile'] });
  }

  return { onBetSuccess };
}
