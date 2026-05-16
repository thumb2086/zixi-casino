import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from './api';

export type TxType = 'bet' | 'chest_open' | 'transfer' | 'item_use' | 'convert' | 'buy';
export type TxStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface TxEntry {
  id: string;
  type: TxType;
  status: TxStatus;
  label: string;
  payload: Record<string, any>;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

interface TxQueueState {
  queue: TxEntry[];
  processing: boolean;
  enqueue: (entry: Omit<TxEntry, 'id' | 'status' | 'createdAt'>) => void;
  updateStatus: (id: string, status: TxStatus, error?: string) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  clearCompleted: () => void;
  processNext: () => Promise<void>;
}

export const useTransactionQueue = create<TxQueueState>()(
  persist(
    (set, get) => ({
      queue: [],
      processing: false,
      enqueue: (entry) => {
        const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        set((state) => ({
          queue: [...state.queue, { ...entry, id, status: 'pending' as TxStatus, createdAt: Date.now() }],
        }));
      },
      updateStatus: (id, status, error) => {
        set((state) => ({
          queue: state.queue.map((e) =>
            e.id === id
              ? { ...e, status, error, completedAt: status === 'completed' || status === 'failed' ? Date.now() : undefined }
              : e,
          ),
        }));
      },
      remove: (id) => {
        set((state) => ({ queue: state.queue.filter((e) => e.id !== id) }));
      },
      retry: (id) => {
        set((state) => ({
          queue: state.queue.map((e) => (e.id === id ? { ...e, status: 'pending' as TxStatus, error: undefined } : e)),
        }));
      },
      clearCompleted: () => {
        set((state) => ({ queue: state.queue.filter((e) => e.status === 'pending' || e.status === 'processing') }));
      },
      processNext: async () => {
        const { queue, processing } = get();
        if (processing) return;
        const next = queue.find((e) => e.status === 'pending');
        if (!next) return;

        set({ processing: true });
        get().updateStatus(next.id, 'processing');

        try {
          const { sessionId, ...body } = next.payload;
          const res = await api.post(next.payload.apiPath || `/api/v1/${next.type}`, {
            ...body,
            sessionId: next.payload.sessionId,
          });
          if (res.data?.success !== false) {
            get().updateStatus(next.id, 'completed');
          } else {
            get().updateStatus(next.id, 'failed', res.data?.error || 'UNKNOWN_ERROR');
          }
        } catch (err: any) {
          get().updateStatus(next.id, 'failed', err?.response?.data?.data?.error || err?.message || 'NETWORK_ERROR');
        } finally {
          set({ processing: false });
        }
      },
    }),
    { name: 'tx-queue-storage' },
  ),
);
