import React from 'react';

export default function ProfileCard({ profile }) {
  if (!profile) return null;

  return (
    <div className="profile-card">
      <img
        src={profile.avatar_url}
        alt={profile.login}
        className="avatar"
        width={88}
        height={88}
      />
      <div className="profile-info">
        <h2>{profile.name || profile.login}</h2>
        <p className="login">@{profile.login}</p>
        {profile.bio && <p className="bio">{profile.bio}</p>}

        <div className="stats">
          <div className="stat">
            <span className="stat-value">{profile.public_repos.toLocaleString()}</span>
            <span className="stat-label">Repos</span>
          </div>
          <div className="stat">
            <span className="stat-value">{profile.followers.toLocaleString()}</span>
            <span className="stat-label">Followers</span>
          </div>
          <div className="stat">
            <span className="stat-value">{profile.following.toLocaleString()}</span>
            <span className="stat-label">Following</span>
          </div>
        </div>

        {profile.location && (
          <p className="location">📍 {profile.location}</p>
        )}
        {profile.blog && (
          <a
            href={
              profile.blog.startsWith('http')
                ? profile.blog
                : `https://${profile.blog}`
            }
            target="_blank"
            rel="noreferrer"
            className="blog-link"
          >
            🔗 {profile.blog}
          </a>
        )}
        <a
          href={profile.html_url}
          target="_blank"
          rel="noreferrer"
          className="github-link"
        >
          View on GitHub →
        </a>
      </div>
    </div>
  );
}
