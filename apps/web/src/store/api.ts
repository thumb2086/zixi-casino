import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './useAuthStore';

const PRIMARY = 'https://zixi-casino-6s1r.onrender.com';
const FALLBACK = 'https://zixi-casino-6s1r.onrender.com';

const envUrl = (import.meta as any).env?.VITE_API_URL;

let activeBaseUrl = envUrl || PRIMARY;
const autoFailover = !envUrl;

export const api = axios.create({
  baseURL: activeBaseUrl,
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
    if (config && !config._retried && autoFailover && activeBaseUrl === PRIMARY) {
      config._retried = true;
      activeBaseUrl = FALLBACK;
      config.baseURL = FALLBACK;
      return api.request(config);
    }
    recordTiming(config);
    return Promise.reject(error);
  }
);
