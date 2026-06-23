import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/useAuthStore';
import { api } from '../../store/api';

export const useSemiconductor = () => {
  const { sessionId } = useAuthStore();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['company'] });
  };

  const produce = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/v1/company/hardware/produce', { sessionId });
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  const claim = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/v1/company/hardware/claim', { sessionId });
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  const research = useMutation({
    mutationFn: async (techId: string) => {
      const res = await api.post('/api/v1/company/hardware/research', { sessionId, techId });
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  const craft = useMutation({
    mutationFn: async (targetNode: string) => {
      const res = await api.post('/api/v1/company/hardware/craft', { sessionId, targetNode });
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  const assemble = useMutation({
    mutationFn: async (computerId: string) => {
      const res = await api.post('/api/v1/company/hardware/assemble', { sessionId, computerId });
      return res.data.data;
    },
    onSuccess: invalidate,
  });

  return { produce, claim, research, craft, assemble };
};
