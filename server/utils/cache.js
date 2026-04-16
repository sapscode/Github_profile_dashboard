// ─── TTL Cache ────────────────────────────────────────────────────────────────
// A simple in-memory cache with Time-To-Live (TTL) expiry. No external dependencies.
//
// Used by: services/githubService.js — every GitHub API call goes through this cache
// to avoid hitting GitHub's rate limits on repeated lookups for the same user.
//
// How it works:
//   - Stores entries in a JavaScript Map (key → { value, expiresAt })
//   - Each entry is stamped with an absolute expiry timestamp when written
//   - On read, if the timestamp has passed, the entry is deleted and null is returned
//   - Expired entries are removed lazily (only when accessed), not on a background timer
//
// Why Map and not a plain object {}?
//   Maps have O(1) lookup and are designed for frequent add/delete operations.
//   Plain objects have prototype chain keys (like "constructor", "toString") that could
//   collide with cache keys if a GitHub username happened to match one.
// ─────────────────────────────────────────────────────────────────────────────

class TTLCache {
  // ttlMs — how long each entry lives before expiring, in milliseconds.
  // Default is 5 minutes. githubService.js passes 5 * 60 * 1000 explicitly.
  constructor(ttlMs = 5 * 60 * 1000) {
    this.cache = new Map(); // the actual storage: key → { value, expiresAt }
    this.ttl = ttlMs;       // stored so set() can compute the expiry timestamp
  }

  // Retrieve an entry by key.
  // Returns the stored value if the entry exists and hasn't expired.
  // Returns null if the key is missing OR if the entry has expired.
  // On expiry: deletes the dead entry from the Map before returning null (lazy eviction).
  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null; // key doesn't exist

    if (Date.now() > entry.expiresAt) {
      // Entry has expired — remove it so it doesn't take up memory indefinitely.
      // This is called "lazy deletion": we don't sweep expired entries proactively;
      // we only evict them when someone tries to read them.
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  // Store a value under a key.
  // expiresAt is an absolute timestamp (milliseconds since epoch), not a relative duration.
  // Absolute timestamps stay correct regardless of how long the server is paused or debugged.
  set(key, value) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + this.ttl, // e.g. right now + 300,000 ms = expires in 5 minutes
    });
  }

  // Returns true if the key exists AND hasn't expired.
  // Reuses get() so expiry logic is never duplicated.
  has(key) {
    return this.get(key) !== null;
  }

  // Remove a single entry immediately, regardless of its TTL.
  delete(key) {
    this.cache.delete(key);
  }

  // Wipe the entire cache — useful for testing or forced refresh.
  clear() {
    this.cache.clear();
  }

  // Returns the count of entries that are still alive (not expired).
  // We can't use this.cache.size directly because the Map may still hold
  // expired entries that haven't been lazily evicted yet — that would overcount.
  // Calling this.get(key) for each entry triggers the expiry check and eviction.
  size() {
    let count = 0;
    for (const [key] of this.cache) {
      if (this.get(key) !== null) count++;
    }
    return count;
  }
}

// Export the class so githubService.js can instantiate it with:
//   const cache = new TTLCache(5 * 60 * 1000);
module.exports = TTLCache;
