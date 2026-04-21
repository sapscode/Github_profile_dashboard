// ─── Entry Point ─────────────────────────────────────────────────────────────
// This is the first file Node runs. Its only job is to:
//   1. Load environment variables from server/.env
//   2. Create the Express app and attach middleware
//   3. Mount the route file (routes/github.js) under a URL prefix
//   4. Start listening on a port
//
// It does NOT talk to GitHub directly — that's all handled in services/githubService.js.
// ─────────────────────────────────────────────────────────────────────────────

// Reads server/.env and copies every variable into process.env so that any file
// in this process can access e.g. process.env.GITHUB_TOKEN or process.env.PORT.
// Must be called before anything else that reads process.env.
require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Imports the router defined in routes/github.js.
// That file maps URL patterns to githubService function calls.
const githubRoutes = require('./routes/github');
const aiRoutes = require('./routes/ai');

const app = express();

// Falls back to 3001 if PORT isn't set in .env.
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
// Middleware runs on every request, in the order it's registered, before any route handler.

// CORS: browsers block requests between different origins by default (different port = different origin).
// CLIENT_URL is set in your hosting provider's env vars (e.g. Render) to the deployed frontend URL.
// Falls back to localhost:5173 for local development so nothing breaks.
const ALLOWED_ORIGIN = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({ origin: ALLOWED_ORIGIN }));

// Parses incoming request bodies as JSON and puts the result on req.body.
// We don't use req.body yet (all our routes are GET), but it's standard to include.
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────

// Mount the github router. Every route defined in routes/github.js gets prefixed with /api/github.
// Example: a route defined as  GET /user/:username  becomes  GET /api/github/user/:username
// See routes/github.js for all the URL definitions.
app.use('/api/github', githubRoutes);
app.use('/api/ai', aiRoutes);

// Health check — a fast endpoint to confirm the server is up and responding.
// The React app (or a monitoring tool) can hit GET /health to verify the server is alive.
// _req means we intentionally don't use the request object.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Fallbacks (must come AFTER all real routes) ───────────────────────────────

// 404 handler — catches any request that didn't match a route above.
// Without this, Express would return an HTML "Cannot GET /..." page, which is confusing
// for a JSON API. This ensures we always respond with JSON.
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// Global error handler — Express recognises this by the 4-parameter signature (err, req, res, next).
// If any route or middleware throws an unhandled error, it lands here instead of crashing the server.
// The eslint comment silences a warning about _req and _next being declared but unused.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
