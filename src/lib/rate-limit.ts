type Entry = { count: number; resetAt: number };

const buckets = new Map<string, Entry>();
const MAX_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
let nextCleanupAt = 0;

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  if (now >= nextCleanupAt) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    nextCleanupAt = now + CLEANUP_INTERVAL_MS;
  }

  let entry = buckets.get(key);
  if (entry?.resetAt !== undefined && entry.resetAt <= now) {
    buckets.delete(key);
    entry = undefined;
  }
  if (!entry) {
    if (buckets.size >= MAX_BUCKETS) {
      return { allowed: false, remaining: 0, resetAt: now + windowMs };
    }
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }
  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}

export function resetRateLimitForTests(): void {
  buckets.clear();
  nextCleanupAt = 0;
}
