import { useState, useEffect, useRef, useCallback } from 'react';

export function usePolling(url, intervalMs) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isStale, setIsStale] = useState(false);
  const timerRef = useRef(null);
  const urlRef = useRef(url);
  urlRef.current = url;

  const doFetch = useCallback(async () => {
    try {
      const resp = await fetch(urlRef.current);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();
      if (json.stale) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
      if (json.error && !json.stale) {
        setError(json.error);
      } else {
        setData(json);
        setError(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    doFetch();
    timerRef.current = setInterval(doFetch, intervalMs);
    return () => clearInterval(timerRef.current);
  }, [url, intervalMs, doFetch]);

  const refetch = useCallback(() => {
    setLoading(true);
    doFetch();
  }, [doFetch]);

  return { data, loading, error, isStale, refetch };
}
