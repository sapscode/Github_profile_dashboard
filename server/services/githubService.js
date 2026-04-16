// ─── Service Layer ────────────────────────────────────────────────────────────
// This file is the core of the backend. It has three responsibilities:
//   1. Configure the Axios client that talks to the GitHub REST API
//   2. Wrap every API call in a cache check (using utils/cache.js) so we don't
//      burn GitHub API rate-limit quota on repeated lookups
//   3. Implement the data-fetching and aggregation logic for each feature
//
// Called by: routes/github.js (every route delegates to a function exported here)
// Calls out to: https://api.github.com  and  utils/cache.js
// ─────────────────────────────────────────────────────────────────────────────

const axios = require('axios');

// TTLCache is our hand-rolled in-memory cache — see utils/cache.js for implementation.
const TTLCache = require('../utils/cache');

// Create one shared cache instance for the entire service.
// TTL = 5 minutes (5 * 60 * 1000 ms). After 5 minutes a cached entry expires
// and the next request for it will go back to GitHub's API.
const cache = new TTLCache(5 * 60 * 1000);

// ── GitHub API Client ─────────────────────────────────────────────────────────
// axios.create() returns a pre-configured Axios instance. Every request made
// through `githubApi` automatically gets the base URL and headers below —
// so we don't have to repeat them on every individual call.
const githubApi = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    // Tells GitHub to use v3 of their API (the current stable version).
    Accept: 'application/vnd.github.v3+json',

    // Conditionally add the Authorization header only if GITHUB_TOKEN is set in .env.
    // Spread syntax with a condition:  ...(condition && { key: value })
    //   — if GITHUB_TOKEN is set, spreads { Authorization: '...' } into the headers object
    //   — if not set, spreads nothing (no header added)
    //
    // Without a token: 60 requests/hour (tied to the server's IP address)
    // With a token:  5,000 requests/hour
    ...(process.env.GITHUB_TOKEN && {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    }),
  },
});

// ── Cache Wrapper ─────────────────────────────────────────────────────────────
// Every public function in this file runs its API call through fetchWithCache.
// This is the "cache-aside" pattern:
//   - Check cache first → if found (HIT), return it immediately, no API call made
//   - If not found (MISS) → call the provided fetchFn(), store the result, return it
//
// @param key      A namespaced string like "user:torvalds" or "repos:torvalds"
//                 Namespacing prevents a username from colliding across different data types.
// @param fetchFn  An async function that performs the actual GitHub API call.
//                 Only executed on a cache miss.
async function fetchWithCache(key, fetchFn) {
  const cached = cache.get(key); // returns null if missing or expired (see utils/cache.js)
  if (cached !== null) return cached; // cache HIT — skip the API call entirely

  // Cache MISS — go fetch the real data.
  const data = await fetchFn();
  cache.set(key, data); // store for up to 5 minutes
  return data;
}

// ── Exported Functions ────────────────────────────────────────────────────────
// These are called directly by routes/github.js. Each one wraps its GitHub API
// call(s) in fetchWithCache so repeated requests within 5 minutes are free.

// Returns the full GitHub user profile object (name, avatar, bio, follower count, etc.)
// Cache key: "user:<username>"
async function getUser(username) {
  return fetchWithCache(`user:${username}`, async () => {
    const { data } = await githubApi.get(`/users/${username}`);
    return data;
  });
}

// Returns all public repos for the user, sorted by most recently updated (up to 100).
// Cache key: "repos:<username>"
// Also used internally by getTopRepos() → getActivity() and getLanguages().
async function getRepos(username) {
  return fetchWithCache(`repos:${username}`, async () => {
    const { data } = await githubApi.get(`/users/${username}/repos`, {
      params: { per_page: 100, sort: 'updated' },
    });
    return data;
  });
}

// ── Internal Helper (not exported) ────────────────────────────────────────────
// Picks the user's most significant original repos to use for activity and language analysis.
// "Significant" = most stars. "Original" = not a fork (forks aren't the user's own work).
//
// Called by: getActivity() and getLanguages() — both need the same set of top repos.
// Reuses getRepos() so the full repo list is only fetched/cached once.
async function getTopRepos(username, count = 5) {
  const repos = await getRepos(username); // uses cached result if available
  return repos
    .filter((r) => !r.fork)                                        // exclude forks
    .sort((a, b) => b.stargazers_count - a.stargazers_count)       // most stars first
    .slice(0, count);                                              // top N repos
}

// ── Commit Activity (with retry logic) ────────────────────────────────────────
// GitHub's commit stats endpoint is computed asynchronously on GitHub's servers.
// The first time you request stats for a repo they haven't cached yet, GitHub returns
// 202 Accepted ("we're computing it, check back soon") instead of 200 with data.
// This function retries up to `retries` times, waiting `delayMs` between each attempt.
//
// Called by: getActivity() — once per top repo, in parallel via Promise.all.
async function getCommitActivityWithRetry(owner, repo, retries = 5, delayMs = 2000) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const { data, status } = await githubApi.get(
      `/repos/${owner}/${repo}/stats/commit_activity`,
      // By default Axios throws an error for any non-2xx response.
      // validateStatus overrides that — here we allow anything below 500 through
      // so our retry loop can inspect the 202 status without catching an exception.
      { validateStatus: (s) => s < 500 }
    );

    if (status === 200 && Array.isArray(data)) return data; // success — got the stats

    if (status === 202) {
      // GitHub is still computing stats — wait and try again.
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      continue;
    }

    // Any other non-200 status (e.g. 404 for a repo with no commits) — give up, return empty.
    return [];
  }

  // Exhausted all retries — return empty so the caller can still show partial data.
  return [];
}

// Returns 52 weeks of commit activity aggregated across the user's top 5 repos.
// Each week's commits from all repos are summed into a single timeline.
// Shape returned: [{ week: 1, commits: 14 }, { week: 2, commits: 7 }, ...]
// Cache key: "activity:<username>"
async function getActivity(username) {
  return fetchWithCache(`activity:${username}`, async () => {
    const topRepos = await getTopRepos(username); // get the 5 most starred original repos

    // Fetch commit activity for all top repos simultaneously (not one-by-one).
    // Promise.all fires all requests in parallel — total wait time = slowest single request,
    // not the sum of all of them. .catch(() => []) means one failed repo won't kill the rest.
    const activitiesPerRepo = await Promise.all(
      topRepos.map((repo) =>
        getCommitActivityWithRetry(username, repo.name).catch(() => [])
      )
    );

    // Aggregate all repo timelines into a single 52-week array.
    // weeks[0] = oldest week, weeks[51] = most recent week.
    const weeks = Array(52).fill(0);
    for (const repoActivity of activitiesPerRepo) {
      if (!Array.isArray(repoActivity)) continue;

      // GitHub may return fewer than 52 weeks for newer repos.
      // We align them to the end of the array (most recent = index 51)
      // by calculating the correct starting offset with: 52 - relevant.length
      const relevant = repoActivity.slice(-52);
      relevant.forEach((week, i) => {
        const idx = i + (52 - relevant.length);
        weeks[idx] += week.total || 0; // week.total is GitHub's commit count for that week
      });
    }

    // Convert to the shape the frontend chart expects: [{ week: 1, commits: N }, ...]
    return weeks.map((total, i) => ({ week: i + 1, commits: total }));
  });
}

// Returns language byte totals across the user's top 5 repos.
// GitHub measures language usage in bytes of source code per language.
// We sum bytes across all repos to get a weighted total — more code = more weight.
// Shape returned: { "JavaScript": 84230, "CSS": 12400, ... }
// Cache key: "languages:<username>"
async function getLanguages(username) {
  return fetchWithCache(`languages:${username}`, async () => {
    const topRepos = await getTopRepos(username);

    // Fetch language breakdown for each repo in parallel.
    // Each response is a plain object like { "JavaScript": 84230, "CSS": 12400 }.
    // .catch(() => ({})) means a failed language fetch returns an empty object
    // so the other repos still contribute to the result.
    const langMaps = await Promise.all(
      topRepos.map((repo) =>
        githubApi
          .get(`/repos/${username}/${repo.name}/languages`)
          .then((r) => r.data)
          .catch(() => ({}))
      )
    );

    // Merge all per-repo language maps into a single totals object by summing bytes.
    const totals = {};
    for (const langMap of langMaps) {
      for (const [lang, bytes] of Object.entries(langMap)) {
        totals[lang] = (totals[lang] || 0) + bytes;
      }
    }
    return totals;
  });
}

// Fetches all data for two users simultaneously and returns them side by side.
// All 8 requests run in parallel via Promise.all — they're independent of each other
// so there's no reason to wait for one before starting the next.
// Each individual function (getUser, getRepos, etc.) still uses its own cache,
// so if either user was recently searched, those results are returned from cache instantly.
async function compareUsers(u1, u2) {
  const [
    user1Data,
    user2Data,
    repos1,
    repos2,
    activity1,
    activity2,
    langs1,
    langs2,
  ] = await Promise.all([
    getUser(u1),
    getUser(u2),
    getRepos(u1),
    getRepos(u2),
    getActivity(u1),
    getActivity(u2),
    getLanguages(u1),
    getLanguages(u2),
  ]);

  // Bundle each user's data into a consistent shape that the frontend CompareView component expects.
  return {
    user1: { profile: user1Data, repos: repos1, activity: activity1, languages: langs1 },
    user2: { profile: user2Data, repos: repos2, activity: activity2, languages: langs2 },
  };
}

// Export only the functions that routes/github.js needs to call directly.
// getTopRepos and getCommitActivityWithRetry are internal helpers — not exported.
module.exports = { getUser, getRepos, getActivity, getLanguages, compareUsers };
