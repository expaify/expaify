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
};
