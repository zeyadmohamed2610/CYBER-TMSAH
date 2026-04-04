interface CacheItem<T> {
  data: T;
  expiry: number;
}

interface CacheConfig {
  ttl?: number;
}

const DEFAULT_TTL = 5 * 60 * 1000;

class SimpleCache {
  private cache: Map<string, CacheItem<unknown>> = new Map();
  private defaultTTL: number;

  constructor(defaultTTL: number = DEFAULT_TTL) {
    this.defaultTTL = defaultTTL;
    
    if (typeof window !== "undefined") {
      setInterval(() => this.cleanup(), 60000);
    }
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key) as CacheItem<T> | undefined;
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  set<T>(key: string, data: T, config?: CacheConfig): void {
    const ttl = config?.ttl ?? this.defaultTTL;
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl,
    });
  }

  remove(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  size(): number {
    return this.cache.size;
  }
}

export const cache = new SimpleCache();

export const createCacheKey = (prefix: string, ...parts: (string | number)[]): string => {
  return `${prefix}:${parts.join(":")}`;
};

export const withCache = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  config?: CacheConfig
): Promise<T> => {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const data = await fetcher();
  cache.set(key, data, config);
  return data;
};

export const invalidateCache = (pattern?: string): void => {
  if (!pattern) {
    cache.clear();
    return;
  }

  const keys = cache.keys();
  const regex = new RegExp(pattern);
  
  for (const key of keys) {
    if (regex.test(key)) {
      cache.remove(key);
    }
  }
};