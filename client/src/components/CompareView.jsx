import React, { useState } from 'react';
import { useGithub } from '../hooks/useGithub';
import ProfileCard from './ProfileCard';
import ActivityChart from './ActivityChart';
import LangChart from './LangChart';
import { ProfileSkeleton, ChartSkeleton } from './Skeleton';

function CompareStats({ label, repos }) {
  if (!repos) return null;
  const totalStars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  const totalForks = repos.reduce((a, r) => a + r.forks_count, 0);
  return (
    <div className="compare-stats-card">
      <h4>@{label}</h4>
      <div className="stat">
        <span className="stat-label">Public Repos</span>
        <span className="stat-value">{repos.length.toLocaleString()}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Total Stars</span>
        <span className="stat-value">{totalStars.toLocaleString()}</span>
      </div>
      <div className="stat">
        <span className="stat-label">Total Forks</span>
        <span className="stat-value">{totalForks.toLocaleString()}</span>
      </div>
    </div>
  );
}

export default function CompareView() {
  const [u1, setU1] = useState('');
  const [u2, setU2] = useState('');
  const { data, loading, error, fetchData } = useGithub();

  const handleCompare = async (e) => {
    e.preventDefault();
    const t1 = u1.trim();
    const t2 = u2.trim();
    if (!t1 || !t2) return;
    await fetchData(
      `/compare?u1=${encodeURIComponent(t1)}&u2=${encodeURIComponent(t2)}`
    );
  };

  return (
    <div className="compare-view">
      <h2 className="section-title">Compare GitHub Users</h2>

      <form className="compare-form" onSubmit={handleCompare}>
        <input
          className="search-input"
          placeholder="First username"
          value={u1}
          onChange={(e) => setU1(e.target.value)}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="vs-badge">VS</span>
        <input
          className="search-input"
          placeholder="Second username"
          value={u2}
          onChange={(e) => setU2(e.target.value)}
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="search-btn"
          disabled={loading || !u1.trim() || !u2.trim()}
        >
          {loading ? 'Comparing...' : 'Compare'}
        </button>
      </form>

      {error && (
        <div className="error-banner">Error: {error}</div>
      )}

      {loading && (
        <>
          <div className="compare-grid">
            <ProfileSkeleton />
            <ProfileSkeleton />
          </div>
          <div className="compare-grid">
            <ChartSkeleton />
            <ChartSkeleton />
          </div>
        </>
      )}

      {data && !loading && (
        <>
          <div className="compare-grid">
            <div className="compare-col">
              <ProfileCard profile={data.user1.profile} />
            </div>
            <div className="compare-col">
              <ProfileCard profile={data.user2.profile} />
            </div>
          </div>

          <div className="compare-grid">
            <ActivityChart activity={data.user1.activity} />
            <ActivityChart activity={data.user2.activity} />
          </div>

          <div className="compare-grid">
            <LangChart languages={data.user1.languages} />
            <LangChart languages={data.user2.languages} />
          </div>

          <div className="compare-grid">
            <CompareStats
              label={data.user1.profile.login}
              repos={data.user1.repos}
            />
            <CompareStats
              label={data.user2.profile.login}
              repos={data.user2.repos}
            />
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div className="empty-state">
          <p>Enter two GitHub usernames above to compare their stats.</p>
        </div>
      )}
    </div>
  );
}
