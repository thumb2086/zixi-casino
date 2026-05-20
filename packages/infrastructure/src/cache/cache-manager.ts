import { kv } from "../kv/index.js";

const DEFAULT_TTL = 30;

function cacheKey(namespace: string, key: string): string {
  return `cache:${namespace}:${key}`;
}

export async function cacheGet<T>(namespace: string, key: string): Promise<T | null> {
  return kv.get<T>(cacheKey(namespace, key));
}

export async function cacheSet(namespace: string, key: string, value: any, ttl = DEFAULT_TTL): Promise<void> {
  await kv.set(cacheKey(namespace, key), value, { ex: ttl });
}

export async function cacheDel(namespace: string, key: string): Promise<void> {
  await kv.del(cacheKey(namespace, key));
}

export async function cacheDelPattern(namespace: string): Promise<void> {
  // Best-effort: store a version counter per namespace so all keys under it are invalidated
  await kv.set(`cache:ns:${namespace}`, Date.now());
}

export async function cacheWrap<T>(
  namespace: string,
  key: string,
  ttl: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = await cacheGet<T>(namespace, key);
  if (cached !== null) return cached;
  const value = await fetcher();
  await cacheSet(namespace, key, value, ttl);
  return value;
}
