import React, { useState } from 'react';
import SearchBar from './components/SearchBar';
import ProfileCard from './components/ProfileCard';
import RepoList from './components/RepoList';
import ActivityChart from './components/ActivityChart';
import LangChart from './components/LangChart';
import CompareView from './components/CompareView';
import { ProfileSkeleton, RepoSkeleton, ChartSkeleton } from './components/Skeleton';

const BASE = 'http://localhost:3001/api/github';

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export default function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [searched, setSearched] = useState(false);
  const [profile, setProfile] = useState(null);
  const [repos, setRepos] = useState(null);
  const [activity, setActivity] = useState(null);
  const [languages, setLanguages] = useState(null);
  const [loading, setLoading] = useState({
    profile: false,
    repos: false,
    activity: false,
    languages: false,
  });
  const [errors, setErrors] = useState({});

  const handleSearch = async (username) => {
    setSearched(true);
    setProfile(null);
    setRepos(null);
    setActivity(null);
    setLanguages(null);
    setErrors({});
    setLoading({ profile: true, repos: true, activity: true, languages: true });

    const [p, r, a, l] = await Promise.allSettled([
      apiFetch(`/user/${username}`),
      apiFetch(`/repos/${username}`),
      apiFetch(`/activity/${username}`),
      apiFetch(`/languages/${username}`),
    ]);

    setLoading({ profile: false, repos: false, activity: false, languages: false });

    if (p.status === 'fulfilled') setProfile(p.value);
    else setErrors((e) => ({ ...e, profile: p.reason.message }));

    if (r.status === 'fulfilled') setRepos(r.value);
    else setErrors((e) => ({ ...e, repos: r.reason.message }));

    if (a.status === 'fulfilled') setActivity(a.value);
    else setErrors((e) => ({ ...e, activity: a.reason.message }));

    if (l.status === 'fulfilled') setLanguages(l.value);
    else setErrors((e) => ({ ...e, languages: l.reason.message }));
  };

  const isLoading = Object.values(loading).some(Boolean);

  return (
    <div className="app">
      <header className="app-header">
        <h1>GitHub Analytics Dashboard</h1>
        <nav className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search User
          </button>
          <button
            className={`tab-btn ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            Compare Users
          </button>
        </nav>
      </header>

      <main className="app-main">
        {activeTab === 'search' && (
          <>
            <SearchBar onSearch={handleSearch} loading={isLoading} />

            {errors.profile && !loading.profile && (
              <div className="error-banner">
                {errors.profile}
              </div>
            )}

            {(isLoading || searched) && (
              <section className="results">
                {loading.profile ? (
                  <ProfileSkeleton />
                ) : (
                  profile && <ProfileCard profile={profile} />
                )}

                <div className="charts-row">
                  {loading.activity ? (
                    <ChartSkeleton />
                  ) : activity ? (
                    <ActivityChart activity={activity} />
                  ) : errors.activity ? (
                    <div className="chart-container">
                      <p className="empty">{errors.activity}</p>
                    </div>
                  ) : null}

                  {loading.languages ? (
                    <ChartSkeleton />
                  ) : languages ? (
                    <LangChart languages={languages} />
                  ) : errors.languages ? (
                    <div className="chart-container">
                      <p className="empty">{errors.languages}</p>
                    </div>
                  ) : null}
                </div>

                {loading.repos ? (
                  <RepoSkeleton />
                ) : repos ? (
                  <RepoList repos={repos} />
                ) : errors.repos ? (
                  <p className="empty">{errors.repos}</p>
                ) : null}
              </section>
            )}

            {!isLoading && !searched && (
              <div className="empty-state">
                <p>Search for a GitHub user to explore their analytics.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'compare' && <CompareView />}
      </main>

      <footer className="app-footer">
        <p>Powered by GitHub REST API &middot; Data cached server-side for 5 minutes</p>
      </footer>
    </div>
  );
}
