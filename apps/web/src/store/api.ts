// apps/web/src/store/api.ts

import axios, { InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './useAuthStore';

// Determine base URL based on environment
const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'https://zixi-casino-beta.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
});

// Interceptor to add session ID to every request
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const { sessionId } = useAuthStore.getState();
  if (sessionId) {
    if (!config.headers) config.headers = {} as any;
    config.headers['x-session-id'] = sessionId;
  }
  (config as any)._startTime = Date.now();
  return config;
});

// Track API timing globally
export const apiTimings: Array<{ endpoint: string; duration: number; timestamp: number }> = [];
const MAX_TIMINGS = 100;

api.interceptors.response.use(
  (response) => {
    const startTime = (response.config as any)._startTime;
    if (startTime) {
      const duration = Date.now() - startTime;
      const endpoint = response.config.url?.split('?')[0] || 'unknown';
      apiTimings.push({ endpoint, duration, timestamp: Date.now() });
      if (apiTimings.length > MAX_TIMINGS) apiTimings.shift();
    }
    return response;
  },
  (error) => {
    if (error.config) {
      const startTime = (error.config as any)._startTime;
      if (startTime) {
        const duration = Date.now() - startTime;
        const endpoint = error.config.url?.split('?')[0] || 'unknown';
        apiTimings.push({ endpoint, duration, timestamp: Date.now() });
        if (apiTimings.length > MAX_TIMINGS) apiTimings.shift();
      }
    }
    return Promise.reject(error);
  }
);
