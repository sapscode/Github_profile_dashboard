# Server Architecture Breakdown

A deep-dive into how the Express backend works — every file, every decision, every connection.

---

## Directory Structure

```
server/
├── index.js              ← Entry point. Boots Express, wires middleware & routes.
├── routes/
│   └── github.js         ← Route definitions. Maps URLs to service calls.
├── services/
│   └── githubService.js  ← Business logic. Talks to GitHub API, manages caching.
└── utils/
    └── cache.js          ← TTL cache implementation. Plain JS class, no dependencies.
```

---

## How a Request Flows Through the Server

```
Browser / React client
        │
        │  GET /api/github/user/torvalds
        ▼
┌──────────────────────────────────────────────────────────┐
│  index.js  (Express app)                                 │
│                                                          │
│  1. CORS middleware  → allows requests from :5173        │
│  2. JSON parser      → parses request body               │
│  3. Route mount      → /api/github  →  routes/github.js  │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  routes/github.js  (Router)                              │
│                                                          │
│  Matches  GET /user/:username                            │
│  Validates the username format                           │
│  Calls     githubService.getUser(username)               │
│  Sends back JSON  or  error JSON                         │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  services/githubService.js  (Business Logic)             │
│                                                          │
│  Checks TTL cache → cache HIT?  return immediately       │
│                  → cache MISS?  call GitHub REST API     │
│  Stores result in cache                                  │
│  Returns data up to the router                           │
└──────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│  utils/cache.js  (TTL Cache)                             │
│                                                          │
│  JavaScript Map under the hood                           │
│  Each entry has a value + expiresAt timestamp            │
│  get() auto-deletes entries past their TTL               │
└──────────────────────────────────────────────────────────┘
        │
        ▼
   GitHub REST API  (https://api.github.com)
```

---

## File-by-File Breakdown

### `index.js` — Entry Point

```js
require('dotenv').config();
```
Loads `server/.env` into `process.env`. Must run first, before anything else reads env vars like `GITHUB_TOKEN` or `PORT`.

```js
const app = express();
const PORT = process.env.PORT || 3001;
```
Creates the Express application. PORT defaults to 3001 if not set in `.env`.

```js
app.use(cors({ origin: 'http://localhost:5173' }));
```
CORS (Cross-Origin Resource Sharing) — browsers block requests between different origins by default. This tells the browser: "requests from `localhost:5173` (our React app) are allowed." Any other origin gets rejected automatically.

```js
app.use(express.json());
```
Middleware that parses incoming request bodies as JSON, making them available as `req.body`. Required for POST/PATCH routes (we don't use them yet, but it's standard to include).

```js
app.use('/api/github', githubRoutes);
```
Mounts the router. Every route defined in `routes/github.js` is prefixed with `/api/github`. So a route defined as `/user/:username` becomes `/api/github/user/:username` publicly.

```js
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
```
A health check endpoint. Useful for confirming the server is running. `_req` (underscore prefix) signals the request object is intentionally unused.

```js
app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} not found` }));
```
404 fallback. If no route matched, this catches it and returns a clear JSON error instead of Express's default HTML "Cannot GET /..." page.

```js
app.use((err, req, res, next) => { ... });
```
Global error handler. Express recognizes error-handler middleware by the 4-parameter signature `(err, req, res, next)`. Any unhandled error thrown in a route or middleware lands here, returning a 500 instead of crashing.

---

### `routes/github.js` — Route Layer

The router's only job is **routing** — map an HTTP verb + URL to the right service function, and handle errors. It knows nothing about GitHub or caching.

#### Why a separate Router instead of putting routes in `index.js`?
Separation of concerns. `index.js` handles app setup. `routes/` handles URL definitions. As the app grows, you'd add `routes/auth.js`, `routes/webhooks.js`, etc. without touching `index.js`.

#### Username Validation
```js
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;
```
GitHub usernames can only contain alphanumeric characters and hyphens, can't start or end with a hyphen, and are max 39 characters. We validate before hitting the service layer — no point making an API call with garbage input.

#### Error Handling Pattern
```js
try {
  const data = await githubService.getUser(username);
  res.json(data);
} catch (err) {
  const status = err.response?.status || 500;
  res.status(status).json({ error: err.message });
}
```
Every route follows this pattern:
- `err.response?.status` — Axios attaches the HTTP response to errors. If GitHub returns 404 (user not found) or 403 (rate limit), we pass that status code directly to the client. The `?.` is optional chaining — if `err.response` is undefined (e.g. a network timeout), it doesn't throw, it just returns `undefined`.
- `|| 500` — Fallback for unexpected errors with no HTTP response attached.

#### Routes at a Glance

| Method | Path | Query Params | Service Call |
|--------|------|-------------|--------------|
| GET | `/api/github/user/:username` | — | `getUser(username)` |
| GET | `/api/github/repos/:username` | — | `getRepos(username)` |
| GET | `/api/github/activity/:username` | — | `getActivity(username)` |
| GET | `/api/github/languages/:username` | — | `getLanguages(username)` |
| GET | `/api/github/compare` | `?u1=&u2=` | `compareUsers(u1, u2)` |

The compare route uses query params (`?u1=alice&u2=bob`) instead of path params because it's a logical query over two resources, not a resource at a specific path.

---

### `services/githubService.js` — Business Logic

This is the heart of the backend. It has three responsibilities:
1. Configure the GitHub API client
2. Implement caching in front of every API call
3. Implement the data-fetching and aggregation logic

#### GitHub API Client (Axios Instance)
```js
const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    Accept: 'application/vnd.github.v3+json',
    ...(process.env.GITHUB_TOKEN && {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    }),
  },
});
```
`axios.create()` creates a pre-configured client — every call made with `githubApi` automatically gets the base URL and headers. This avoids repeating them on every request.

`Accept: application/vnd.github.v3+json` — tells GitHub to respond with v3 of their API (the stable version).

`...(condition && { key: value })` — conditional spread. If `GITHUB_TOKEN` is set, adds the `Authorization` header. If not, it adds nothing. This makes the token optional — the server works either way, just with lower rate limits.

**Rate limits:**
- Unauthenticated: 60 requests / hour (tied to server IP)
- Authenticated with PAT: 5,000 requests / hour

#### The Cache Wrapper
```js
async function fetchWithCache(key, fetchFn) {
  const cached = cache.get(key);
  if (cached !== null) return cached;
  const data = await fetchFn();
  cache.set(key, data);
  return data;
}
```
Every service function runs through this wrapper. It's a **cache-aside** pattern:
1. Check cache → HIT: return immediately (no API call)
2. MISS: call the provided `fetchFn()`, store the result, return it

Cache keys are namespaced by type: `user:torvalds`, `repos:torvalds`, `activity:torvalds`. This prevents collisions and makes it easy to understand what's cached.

#### `getTopRepos(username, count = 5)`
```js
repos
  .filter((r) => !r.fork)          // exclude forks — not the user's original work
  .sort((a, b) => b.stargazers_count - a.stargazers_count)  // most starred first
  .slice(0, count)                  // top N
```
Used internally by `getActivity` and `getLanguages`. Not exposed as a route — it's a private helper. We analyze top repos by stars because they're the most significant and representative of a user's work.

#### `getCommitActivityWithRetry` — The Tricky One
```js
async function getCommitActivityWithRetry(owner, repo, retries = 5, delayMs = 2000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, status } = await githubApi.get(
      `/repos/${owner}/${repo}/stats/commit_activity`,
      { validateStatus: (s) => s < 500 }
    );
    if (status === 200 && Array.isArray(data)) return data;
    if (status === 202) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }
    return [];
  }
  return [];
}
```
GitHub's commit stats endpoint is **asynchronous on their side**. When stats aren't cached on GitHub's servers yet, they return `202 Accepted` (meaning "we're computing it, try again"). This function handles that by retrying up to 5 times with a 2-second wait between attempts.

`validateStatus: (s) => s < 500` — by default, Axios throws on any non-2xx response. This overrides that to allow 202 through without throwing, so our retry loop can handle it.

#### `getActivity(username)`
Fetches commit activity for the top 5 repos and **aggregates them into a single 52-week timeline**:
```js
const weeks = Array(52).fill(0);
for (const repoActivity of activitiesPerRepo) {
  const relevant = repoActivity.slice(-52);
  relevant.forEach((week, i) => {
    const idx = i + (52 - relevant.length);
    weeks[idx] += week.total || 0;
  });
}
```
GitHub returns up to 52 weeks per repo. We align them to the same 52-week window and sum commit counts across all repos per week. This gives a composite view of activity across a user's most significant work.

Output shape: `[{ week: 1, commits: 14 }, { week: 2, commits: 7 }, ...]`

#### `getLanguages(username)`
Fetches per-repo language breakdowns and merges them:
```js
for (const [lang, bytes] of Object.entries(langMap)) {
  totals[lang] = (totals[lang] || 0) + bytes;
}
```
GitHub returns language stats as byte counts (e.g., `{ "JavaScript": 84230, "CSS": 12400 }`). We sum bytes across all top repos. The result is a byte-weighted total — more code = more weight, which is more accurate than just counting repos that use a language.

#### `compareUsers(u1, u2)`
```js
const [user1Data, user2Data, repos1, repos2, activity1, activity2, langs1, langs2] =
  await Promise.all([...]);
```
`Promise.all` fires all 8 requests **concurrently** — not sequentially. Since each call is independent, waiting for them one at a time would be unnecessarily slow. With `Promise.all`, total time ≈ slowest single request, not sum of all requests.

---

### `utils/cache.js` — TTL Cache

A hand-rolled cache class using JavaScript's built-in `Map`. No external dependencies.

```js
class TTLCache {
  constructor(ttlMs = 5 * 60 * 1000) {  // default: 5 minutes
    this.cache = new Map();
    this.ttl = ttlMs;
  }
```

#### Why a Map and not a plain object `{}`?
Maps are designed for frequent add/delete operations, have O(1) lookup, and don't have prototype chain collisions (a plain object has inherited keys like `constructor`, `toString`, etc. that could collide with cache keys).

#### TTL (Time-To-Live) Mechanism
```js
set(key, value) {
  this.cache.set(key, {
    value,
    expiresAt: Date.now() + this.ttl,  // absolute expiry timestamp
  });
}

get(key) {
  const entry = this.cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    this.cache.delete(key);  // lazy deletion — only evicts on access
    return null;
  }
  return entry.value;
}
```
This is **lazy expiration** — entries aren't proactively swept. They're only evicted when someone tries to read them. This is efficient: no background timer needed, and we only pay the eviction cost when we would have hit the cache anyway.

We store `expiresAt` as an absolute timestamp (`Date.now() + ttl`) rather than a relative duration. Why? Because if you stored "expires in 5 minutes" and the server was paused/debugged, relative time becomes wrong. Absolute timestamps are always correct regardless of when you check.

#### Why 5-minute TTL?
A balance between freshness and rate limit conservation. GitHub profiles don't change every second. 5 minutes means a popular user can be searched many times without burning API quota. The cache is in-memory (not persisted), so it resets when the server restarts.

---

## Key Design Patterns — Interview Talking Points

### 1. Layered Architecture
The code is split into three clear layers with one-way dependencies:
- Routes depend on Services
- Services depend on Cache + Axios
- Cache has no dependencies

This means you can swap out the cache implementation, change the HTTP client, or add new routes without touching the other layers.

### 2. Cache-Aside Pattern
The service layer checks the cache before making any external API call. This is the most common caching pattern in backend development. The alternative (cache-through) has the cache sit in the request path and manage fetching itself — we chose cache-aside because it gives the service layer full control over what gets cached and how.

### 3. Graceful Degradation
Every `Promise.all` call that fetches per-repo data uses `.catch(() => [])` or `.catch(() => ({}))` on individual promises. If one repo's language fetch fails, the others still succeed. The app shows partial data rather than crashing entirely.

### 4. Transparent Rate-Limit Passthrough
When GitHub returns 403 (rate limited) or 404 (not found), the router passes that exact status code to the client:
```js
const status = err.response?.status || 500;
res.status(status).json({ error: err.message });
```
The frontend doesn't need special logic — it receives the real HTTP status and can display an appropriate message.

### 5. Optional Authentication
The GitHub token is injected only if present, using conditional spread:
```js
...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${token}` })
```
The server works in both modes — useful for local dev without a token, and for production with one.

### 6. Concurrent Fetching with Promise.all
Wherever we need multiple independent pieces of data, we use `Promise.all` to fetch them in parallel. This is a critical performance optimization — fetching 8 things sequentially would take 8× longer than fetching them concurrently.

---

## API Endpoints Reference

Base URL: `http://localhost:3001`

| Endpoint | Description | Response |
|----------|-------------|----------|
| `GET /health` | Server health check | `{ status: 'ok' }` |
| `GET /api/github/user/:username` | GitHub profile data | GitHub user object |
| `GET /api/github/repos/:username` | All public repos (up to 100) | Array of repo objects |
| `GET /api/github/activity/:username` | 52-week commit activity | `[{ week: N, commits: N }]` |
| `GET /api/github/languages/:username` | Language bytes across top 5 repos | `{ "JavaScript": 84230, ... }` |
| `GET /api/github/compare?u1=A&u2=B` | Full profile data for two users | `{ user1: {...}, user2: {...} }` |

**Error format (all endpoints):**
```json
{ "error": "Not Found" }
```
Status code matches GitHub's response (404, 403, 500, etc.).

---

## Environment Variables

Defined in `server/.env`:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Port the server listens on |
| `GITHUB_TOKEN` | Recommended | none | GitHub Personal Access Token for higher rate limits |

Generate a token at `https://github.com/settings/tokens` — no scopes needed for public data.