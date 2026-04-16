// ─── Route Layer ─────────────────────────────────────────────────────────────
// This file defines every URL the server exposes under /api/github (the prefix is
// added by index.js when it does:  app.use('/api/github', githubRoutes) ).
//
// The router's only jobs are:
//   1. Validate the incoming request (username format, required params)
//   2. Call the right function in githubService.js
//   3. Send back the result as JSON, or an error if something went wrong
//
// It does NOT contain any logic for fetching from GitHub or managing the cache —
// that all lives in services/githubService.js.
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');

// express.Router() creates a mini-app that holds a group of related routes.
// It gets mounted onto the main app in index.js.
const router = express.Router();

// Import the service layer. Every route delegates to one of these functions.
// githubService handles GitHub API calls and caching — the router doesn't need to know those details.
const githubService = require('../services/githubService');

// ── Username Validation ───────────────────────────────────────────────────────
// GitHub usernames can only contain letters, numbers, and hyphens.
// They can't start or end with a hyphen, and are maximum 39 characters long.
// We validate before calling the service so we don't waste an API call on garbage input.
//
// Regex breakdown:
//   ^                         — start of string
//   [a-zA-Z0-9]               — must start with a letter or number
//   (?:[a-zA-Z0-9-]{0,37}     — optionally: up to 37 chars of letters, numbers, or hyphens
//   [a-zA-Z0-9])?             — if those middle chars exist, must end with letter or number
//   $                         — end of string
const USERNAME_RE = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function validUsername(username) {
  return USERNAME_RE.test(username);
}

// ── Routes ────────────────────────────────────────────────────────────────────
// Each route follows the same 3-step pattern:
//   1. Validate input — reject early with 400 if invalid
//   2. Call the service — await the result
//   3. Respond — send JSON on success, or an error JSON on failure
//
// Error handling:
//   err.response?.status  — Axios attaches GitHub's HTTP response to the error object.
//                           If GitHub said 404 (user not found) or 403 (rate limited),
//                           we forward that exact status code to the client.
//   ?. (optional chaining) — if err.response doesn't exist (e.g. network timeout),
//                           this safely returns undefined instead of throwing.
//   || 500                 — fallback for unexpected errors with no HTTP response.

// GET /api/github/user/:username
// Returns the GitHub profile for a single user (name, avatar, bio, followers, etc.)
// Delegates to → githubService.getUser()
router.get('/user/:username', async (req, res) => {
  if (!validUsername(req.params.username)) {
    return res.status(400).json({ error: 'Invalid GitHub username' });
  }
  try {
    const data = await githubService.getUser(req.params.username);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/github/repos/:username
// Returns all public repos for the user (up to 100), sorted by most recently updated.
// Delegates to → githubService.getRepos()
router.get('/repos/:username', async (req, res) => {
  if (!validUsername(req.params.username)) {
    return res.status(400).json({ error: 'Invalid GitHub username' });
  }
  try {
    const data = await githubService.getRepos(req.params.username);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/github/activity/:username
// Returns 52 weeks of commit activity, aggregated across the user's top 5 repos by stars.
// Shape: [{ week: 1, commits: 14 }, { week: 2, commits: 7 }, ...]
// Delegates to → githubService.getActivity()
router.get('/activity/:username', async (req, res) => {
  if (!validUsername(req.params.username)) {
    return res.status(400).json({ error: 'Invalid GitHub username' });
  }
  try {
    const data = await githubService.getActivity(req.params.username);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/github/languages/:username
// Returns language byte totals summed across the user's top 5 repos by stars.
// Shape: { "JavaScript": 84230, "CSS": 12400, ... }
// Delegates to → githubService.getLanguages()
router.get('/languages/:username', async (req, res) => {
  if (!validUsername(req.params.username)) {
    return res.status(400).json({ error: 'Invalid GitHub username' });
  }
  try {
    const data = await githubService.getLanguages(req.params.username);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/github/compare?u1=alice&u2=bob
// Returns full profile + repos + activity + languages for two users side by side.
// Uses query params (?u1=&u2=) instead of path params because this is a comparison
// query over two resources, not a single resource at a specific path.
// Delegates to → githubService.compareUsers()
router.get('/compare', async (req, res) => {
  const { u1, u2 } = req.query;

  // Both usernames are required — return 400 immediately if either is missing.
  if (!u1 || !u2) {
    return res.status(400).json({ error: 'Both u1 and u2 query params are required' });
  }

  if (!validUsername(u1) || !validUsername(u2)) {
    return res.status(400).json({ error: 'Invalid GitHub username' });
  }

  try {
    const data = await githubService.compareUsers(u1, u2);
    res.json(data);
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ error: err.message });
  }
});

// Export the router so index.js can mount it with app.use('/api/github', githubRoutes).
module.exports = router;
