import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface AuthState {
  address: string | null;
  sessionId: string | null;
  publicKey: string | null;
  isAuthorized: boolean;
  setAuth: (address: string, sessionId: string, publicKey: string) => void;
  clearAuth: () => void;
}

const sessionStorageWrapper = {
  getItem: (name: string) => {
    const val = sessionStorage.getItem(name);
    return val;
  },
  setItem: (name: string, value: string) => {
    sessionStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    sessionStorage.removeItem(name);
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      address: null,
      sessionId: null,
      publicKey: null,
      isAuthorized: false,
      setAuth: (address, sessionId, publicKey) => set({ address, sessionId, publicKey, isAuthorized: true }),
      clearAuth: () => set({ address: null, sessionId: null, publicKey: null, isAuthorized: false }),
    }),
    { name: 'auth-storage', storage: createJSONStorage(() => sessionStorageWrapper) }
  )
);
