import { Redis } from "@upstash/redis";
import { KVClient } from "./index.js";

export class UpstashKV implements KVClient {
  private redis: Redis;

  constructor() {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    if (url && token) {
      this.redis = new Redis({ url, token });
    } else {
      console.warn("⚠️ Upstash Redis credentials missing (KV_REST_API_URL / KV_REST_API_TOKEN). Running with mock.");
      this.redis = null as any;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.redis) return null;
    try {
      return await this.redis.get<T>(key);
    } catch (err) {
      console.error(`KV get error (${key}):`, err);
      return null;
    }
  }

  async set(key: string, value: any, options?: { ex?: number }): Promise<string> {
    if (!this.redis) return "OK";
    try {
      if (options?.ex) {
        await this.redis.set(key, value, { ex: options.ex });
      } else {
        await this.redis.set(key, value);
      }
      return "OK";
    } catch (err) {
      console.error(`KV set error (${key}):`, err);
      return "OK";
    }
  }

  async del(key: string): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.del(key);
    } catch (err) {
      console.error(`KV del error (${key}):`, err);
      return 0;
    }
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.sadd(key, ...(members as [string, ...string[]]));
    } catch {
      return 0;
    }
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.srem(key, ...(members as [string, ...string[]]));
    } catch {
      return 0;
    }
  }

  async smembers(key: string): Promise<string[]> {
    if (!this.redis) return [];
    try {
      return await this.redis.smembers(key);
    } catch {
      return [];
    }
  }

  async lpush(key: string, ...values: any[]): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.lpush(key, ...(values as [any, ...any[]]));
    } catch (err) {
      console.error(`KV lpush error (${key}):`, err);
      return 0;
    }
  }

  async lrange<T>(key: string, start: number, stop: number): Promise<T[]> {
    if (!this.redis) return [];
    try {
      return await this.redis.lrange(key, start, stop);
    } catch (err) {
      console.error(`KV lrange error (${key}):`, err);
      return [];
    }
  }

  async ltrim(key: string, start: number, stop: number): Promise<string> {
    if (!this.redis) return "OK";
    try {
      await this.redis.ltrim(key, start, stop);
      return "OK";
    } catch (err) {
      console.error(`KV ltrim error (${key}):`, err);
      return "OK";
    }
  }

  async claimSlot(key: string, ttlSeconds: number, value: string): Promise<boolean> {
    if (!this.redis) return false;
    try {
      const result = await this.redis.set(key, value, { nx: true, ex: ttlSeconds });
      return result !== null && result !== undefined;
    } catch {
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.redis) return 0;
    try {
      return await this.redis.expire(key, seconds);
    } catch {
      return 0;
    }
  }

  async ping(): Promise<boolean> {
    if (!this.redis) return false;
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  async incr(key: string): Promise<number> {
    if (!this.redis) return 0;
    try { return await this.redis.incr(key); } catch { return 0; }
  }

  async incrby(key: string, increment: number): Promise<number> {
    if (!this.redis) return 0;
    try { return await this.redis.incrby(key, increment); } catch { return 0; }
  }
}
