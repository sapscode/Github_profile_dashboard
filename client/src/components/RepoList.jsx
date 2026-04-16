import React, { useState } from 'react';

export default function RepoList({ repos }) {
  const [showAll, setShowAll] = useState(false);

  if (!repos || repos.length === 0) {
    return <p className="empty">No public repositories found.</p>;
  }

  const sorted = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count);
  const displayed = showAll ? sorted : sorted.slice(0, 6);

  return (
    <div className="repo-list">
      <h3 className="section-title">Repositories ({repos.length})</h3>
      <div className="repos-grid">
        {displayed.map((repo) => (
          <a
            key={repo.id}
            href={repo.html_url}
            target="_blank"
            rel="noreferrer"
            className="repo-card"
          >
            <div className="repo-header">
              <span className="repo-name">{repo.name}</span>
              {repo.fork && <span className="fork-badge">Fork</span>}
            </div>
            {repo.description && (
              <p className="repo-desc">{repo.description}</p>
            )}
            <div className="repo-meta">
              {repo.language && (
                <span className="repo-lang">{repo.language}</span>
              )}
              <span className="repo-stars">⭐ {repo.stargazers_count.toLocaleString()}</span>
              <span className="repo-forks">🍴 {repo.forks_count.toLocaleString()}</span>
            </div>
          </a>
        ))}
      </div>
      {repos.length > 6 && (
        <button className="show-more-btn" onClick={() => setShowAll((p) => !p)}>
          {showAll ? 'Show less' : `Show all ${repos.length} repositories`}
        </button>
      )}
    </div>
  );
}
