import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './useAuthStore';

const PRIMARY = 'https://zixi-casino-6s1r.onrender.com';

const envUrl = (import.meta as any).env?.VITE_API_URL;

let activeBaseUrl = envUrl || PRIMARY;

let isWakingUp = false;
let wakeUpPromise: Promise<void> | null = null;

export function setIsWakingUp(v: boolean) { isWakingUp = v; }
export function getIsWakingUp() { return isWakingUp; }

async function waitForColdStart(attempts = 0): Promise<boolean> {
  if (attempts >= 8) return false;
  await new Promise(r => setTimeout(r, 3000 + attempts * 2000)); // 3s, 5s, 7s...
  try {
    await axios.get(`${activeBaseUrl}/api/diag`, { timeout: 10000 });
    return true;
  } catch {
    return waitForColdStart(attempts + 1);
  }
}

export const api = axios.create({
  baseURL: activeBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { sessionId } = useAuthStore.getState();
  if (sessionId) {
    if (!config.headers) config.headers = {} as any;
    config.headers['x-session-id'] = sessionId;
  }
  (config as any)._startTime = Date.now();
  return config;
});

export const apiTimings: Array<{ endpoint: string; duration: number; timestamp: number }> = [];
const MAX_TIMINGS = 100;

function recordTiming(config: any) {
  const startTime = config?._startTime;
  if (startTime) {
    const duration = Date.now() - startTime;
    const endpoint = config.url?.split('?')[0] || 'unknown';
    apiTimings.push({ endpoint, duration, timestamp: Date.now() });
    if (apiTimings.length > MAX_TIMINGS) apiTimings.shift();
  }
}

api.interceptors.response.use(
  (response) => {
    recordTiming(response.config);
    return response;
  },
  async (error) => {
    const config = error.config;
    recordTiming(config);

    // Auto-retry on 502 (Render cold start)
    const is502 = error.response?.status === 502 || error.response?.status === 503;
    if (is502 && config && !config._retried) {
      config._retried = true;
      if (!isWakingUp) {
        isWakingUp = true;
        wakeUpPromise = waitForColdStart().then(ok => { isWakingUp = false; return ok as any; });
      }
      await wakeUpPromise;
      return api.request(config);
    }

    return Promise.reject(error);
  }
);
