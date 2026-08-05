import Redis from 'ioredis';

let _client: Redis | null = null;

function getClient(): Redis {
  // Read env var at call time so tests can inject REDIS_URL before first use
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is not set');
  if (!_client) {
    _client = new Redis(url, {
      lazyConnect: false,
      enableOfflineQueue: true,
      tls: url.startsWith('rediss://') ? {} : undefined,
    });
  }
  return _client;
}

export const cache = {
  async get<T>(key: string): Promise<T | null> {
    const raw = await getClient().get(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  },

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds);
  },

  /**
   * Atomic set-if-absent (Redis `SET key value NX EX ttl`). Returns `true`
   * when this call created the key (caller holds the lock), `false` when the
   * key already existed (someone else holds it). Used for idempotency/lock
   * keys where a plain get-then-set would race two concurrent requests into
   * both believing they're first.
   */
  async setIfAbsent<T>(key: string, value: T, ttlSeconds: number): Promise<boolean> {
    const result = await getClient().set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  },
};
