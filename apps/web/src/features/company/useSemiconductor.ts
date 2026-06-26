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
    onMutate: () => {
      const prev = queryClient.getQueryData(['company']);
      queryClient.setQueryData(['company'], (old: any) => {
        if (!old?.company?.data) return old;
        return {
          ...old,
          company: {
            ...old.company,
            data: {
              ...old.company.data,
              isProducing: true,
              productionRemainingMs: old.company.data.productionDuration || 14400000,
            },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['company'], ctx.prev);
    },
    onSettled: invalidate,
  });

  const claim = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/v1/company/hardware/claim', { sessionId });
      return res.data.data;
    },
    onMutate: () => {
      const prev = queryClient.getQueryData(['company']);
      queryClient.setQueryData(['company'], (old: any) => {
        if (!old?.company?.data) return old;
        return {
          ...old,
          company: {
            ...old.company,
            data: {
              ...old.company.data,
              isProducing: false,
              production: null,
            },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['company'], ctx.prev);
    },
    onSettled: invalidate,
  });

  const research = useMutation({
    mutationFn: async (techId: string) => {
      const res = await api.post('/api/v1/company/hardware/research', { sessionId, techId });
      return res.data.data;
    },
    onMutate: async (techId) => {
      await queryClient.cancelQueries({ queryKey: ['company'] });
      const prev = queryClient.getQueryData(['company']);
      queryClient.setQueryData(['company'], (old: any) => {
        if (!old?.company?.data?.techTree) return old;
        return {
          ...old,
          company: {
            ...old.company,
            data: {
              ...old.company.data,
              techTree: old.company.data.techTree.map((t: any) =>
                t.id === techId && t.canUpgrade
                  ? { ...t, currentLevel: t.currentLevel + 1, canUpgrade: t.currentLevel + 1 < t.maxLevel }
                  : t
              ),
            },
          },
        };
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(['company'], ctx.prev);
    },
    onSettled: invalidate,
  });

  const craft = useMutation({
    mutationFn: async (targetNode: string) => {
      const res = await api.post('/api/v1/company/hardware/craft', { sessionId, targetNode });
      return res.data.data;
    },
    onSettled: invalidate,
  });

  const assemble = useMutation({
    mutationFn: async (computerId: string) => {
      const res = await api.post('/api/v1/company/hardware/assemble', { sessionId, computerId });
      return res.data.data;
    },
    onSettled: invalidate,
  });

  return { produce, claim, research, craft, assemble };
};
