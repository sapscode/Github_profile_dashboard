import { useState, useCallback } from 'react';

// In development this falls back to localhost.
// In production, set VITE_API_URL in your hosting provider (e.g. Vercel) to
// point at your deployed backend, e.g. https://your-app.onrender.com/api/github
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api/github';

export function useGithub() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async (endpoint) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`${BASE_URL}${endpoint}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed with status ${res.status}`);
      }
      const json = await res.json();
      setData(json);
      return json;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, fetchData, reset };
}
