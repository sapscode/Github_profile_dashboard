import React, { useState } from 'react';

const AI_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/ai`
  : 'http://localhost:3001/api/ai';

function computeStats(profile, repos, activity, languages) {
  const totalStars = repos
    ? repos.reduce((sum, r) => sum + (r.stargazers_count || 0), 0)
    : 0;

  const topLanguages = languages ? Object.keys(languages).slice(0, 4) : [];

  const avgCommitsPerWeek =
    activity && activity.length > 0
      ? Math.round(activity.reduce((sum, w) => sum + w.commits, 0) / activity.length)
      : 0;

  let longestStreak = 0;
  let currentStreak = 0;
  if (activity) {
    for (const week of activity) {
      if (week.commits > 0) {
        currentStreak++;
        if (currentStreak > longestStreak) longestStreak = currentStreak;
      } else {
        currentStreak = 0;
      }
    }
  }

  return {
    repoCount: profile.public_repos || 0,
    totalStars,
    topLanguages,
    avgCommitsPerWeek,
    longestStreak,
  };
}

export default function AISummary({ profile, repos, activity, languages }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    setSummary('');

    const stats = computeStats(profile, repos, activity, languages);

    try {
      const res = await fetch(`${AI_BASE}/summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: profile.login, stats }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate summary');
      setSummary(data.summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-summary">
      {!summary && !loading && (
        <button className="ai-generate-btn" onClick={generate} disabled={loading}>
          <span className="ai-sparkle">✦</span> Generate AI Summary
        </button>
      )}

      {loading && (
        <p className="ai-loading">
          <span className="ai-sparkle">✦</span> Analyzing profile...
        </p>
      )}

      {error && (
        <div className="ai-error">
          {error}
          <button className="ai-regenerate-btn" onClick={generate}>Try again</button>
        </div>
      )}

      {summary && (
        <div className="ai-summary-card">
          <div className="ai-summary-header">
            <span className="ai-sparkle">✦</span>
            <span className="ai-summary-label">AI Developer Summary</span>
            <button className="ai-regenerate-btn" onClick={generate} disabled={loading}>
              {loading ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
          <p className="ai-summary-text">{summary}</p>
        </div>
      )}
    </div>
  );
}
