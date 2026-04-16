# GitHub Analytics Dashboard

A full-stack web application for exploring and comparing GitHub user profiles with rich visualizations.

## Features

- **User Profile** — avatar, bio, follower/following counts, location, and direct link to GitHub
- **Commit Activity Chart** — bar chart of weekly commit frequency over 52 weeks, aggregated across a user's top 5 repos (with automatic retry for GitHub's async 202 responses)
- **Language Breakdown** — donut chart of byte-weighted language usage across top 5 repos
- **Repository Browser** — repos sorted by stars, with language, star, and fork counts; expand to view all
- **Compare Mode** — search two users side-by-side; shows profiles, activity charts, language charts, and aggregate stats
- **Loading Skeletons** — shimmer placeholders for every section while data loads
- **Graceful Error Handling** — per-section error display; a failed languages fetch does not block the profile from rendering
- **Server-Side Cache** — in-memory TTL cache (5 min) to reduce GitHub API rate-limit pressure

## Tech Stack

| Layer    | Technology |
|----------|------------|
| Frontend | React 18, Vite, Recharts |
| Backend  | Node.js, Express |
| HTTP     | Axios (server), Fetch API (client) |
| Cache    | In-memory Map with TTL (`server/utils/cache.js`) |
| API      | GitHub REST API v3 (no GraphQL) |

## Project Structure

    github-analytics-dashboard/
    ├── package.json                  # Root: concurrently dev script
    ├── .env.example
    ├── client/
    │   ├── index.html
    │   ├── vite.config.js
    │   ├── package.json
    │   └── src/
    │       ├── main.jsx
    │       ├── App.jsx               # Main layout, tab navigation
    │       ├── index.css             # Dark GitHub-inspired theme
    │       ├── hooks/
    │       │   └── useGithub.js      # Fetch + loading + error hook
    │       └── components/
    │           ├── SearchBar.jsx
    │           ├── ProfileCard.jsx
    │           ├── RepoList.jsx
    │           ├── ActivityChart.jsx  # Bar chart (52 weeks)
    │           ├── LangChart.jsx      # Donut chart
    │           ├── CompareView.jsx    # Side-by-side comparison
    │           └── Skeleton.jsx       # Loading placeholders
    └── server/
        ├── index.js                  # Express app (port 3001)
        ├── package.json
        ├── .env
        ├── routes/
        │   └── github.js             # REST route handlers
        ├── services/
        │   └── githubService.js      # GitHub API calls + cache logic
        └── utils/
            └── cache.js              # TTLCache class

## Setup

### 1. Install dependencies

```bash
cd github-analytics-dashboard
npm run install:all
```

### 2. Configure a GitHub token (strongly recommended)

Copy the example env file and add your token:

```bash
cp .env.example server/.env
```

Edit `server/.env`:

```
GITHUB_TOKEN=ghp_your_token_here
PORT=3001
```

Without a token the GitHub API allows **60 requests/hour** (unauthenticated).
With a token the limit rises to **5,000 requests/hour**.

Generate a token at: https://github.com/settings/tokens  
Only the default public read scopes are needed.

### 3. Start both servers

```bash
npm run dev
```

This starts:
- **Backend** → http://localhost:3001
- **Frontend** → http://localhost:5173

Open http://localhost:5173 in your browser.

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/github/user/:username` | Fetch user profile |
| GET | `/api/github/repos/:username` | Fetch all public repos (sorted by updated) |
| GET | `/api/github/activity/:username` | 52-week commit totals across top 5 repos |
| GET | `/api/github/languages/:username` | Aggregated language bytes across top 5 repos |
| GET | `/api/github/compare?u1=&u2=` | Compare two users (parallel fetch) |
| GET | `/health` | Health check |

## Notes

- Commit activity uses GitHub's stats API which may return `202 Accepted` while stats are computed. The server retries up to 5 times with a 2-second delay before returning an empty result.
- Top repos are determined by star count after excluding forks.
- All API responses are cached server-side for 5 minutes.
