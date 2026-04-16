import React from 'react';

function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton ${className}`} />;
}

export function ProfileSkeleton() {
  return (
    <div className="profile-card skeleton-wrapper" style={{ marginBottom: 24 }}>
      <SkeletonBlock className="sk-avatar" />
      <div className="profile-info">
        <SkeletonBlock className="sk-title" />
        <SkeletonBlock className="sk-text short" />
        <SkeletonBlock className="sk-text" />
        <div className="stats" style={{ marginTop: 12 }}>
          <SkeletonBlock className="sk-stat" />
          <SkeletonBlock className="sk-stat" />
          <SkeletonBlock className="sk-stat" />
        </div>
      </div>
    </div>
  );
}

export function RepoSkeleton() {
  return (
    <div className="repo-list skeleton-wrapper">
      <SkeletonBlock className="sk-text short" style={{ marginBottom: 16 }} />
      <div className="repos-grid">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="repo-card skeleton-wrapper"
            style={{ display: 'block', pointerEvents: 'none' }}
          >
            <SkeletonBlock className="sk-text" style={{ width: '60%', marginBottom: 8 }} />
            <SkeletonBlock className="sk-text" />
            <SkeletonBlock className="sk-text short" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="chart-container skeleton-wrapper">
      <SkeletonBlock className="sk-text short" style={{ marginBottom: 16 }} />
      <SkeletonBlock className="sk-chart" />
    </div>
  );
}
