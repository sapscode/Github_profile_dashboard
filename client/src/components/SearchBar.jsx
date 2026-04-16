import React, { useState } from 'react';

export default function SearchBar({ onSearch, loading }) {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (trimmed) onSearch(trimmed);
  };

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter GitHub username..."
        disabled={loading}
        className="search-input"
        autoComplete="off"
        spellCheck={false}
      />
      <button
        type="submit"
        disabled={loading || !username.trim()}
        className="search-btn"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
