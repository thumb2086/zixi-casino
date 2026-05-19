import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../store/api';

const API_BASE = '/api/v1/market';

export const useMarket = () => {
  const { sessionId } = useAuthStore();
  const queryClient = useQueryClient();

  const getSnapshot = useQuery({
    queryKey: ['market-snapshot'],
    queryFn: async () => {
      const res = await api.get(`${API_BASE}/snapshot`);
      return res.data.data.snapshot;
    },
    refetchInterval: 5000
  });

  const getMyAccount = useQuery({
    queryKey: ['market-me'],
    queryFn: async () => {
      const res = await api.get(`${API_BASE}/me`, { params: { sessionId } });
      return res.data.data.account;
    },
    refetchInterval: 5000
  });

  const actionMutation = useMutation({
    mutationFn: async (params: any) => {
      const res = await api.post(`${API_BASE}/action`, { ...params, sessionId });
      if (res.data.error) throw new Error(res.data.error.message);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['market-me'] });
      queryClient.invalidateQueries({ queryKey: ['user-me'] });
      queryClient.invalidateQueries({ queryKey: ['market-snapshot'] });
    },
    onSettled: () => {
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['market-me'] });
        queryClient.refetchQueries({ queryKey: ['market-snapshot'] });
      }, 500);
    }
  });

  return {
    snapshot: getSnapshot,
    account: getMyAccount,
    execute: actionMutation
  };
};
