import { useState, useEffect, useCallback } from 'react';

interface UseApiDataResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
  isLive: boolean;
  refetch: () => void;
}

export function useApiData<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  pollInterval?: number,
): UseApiDataResult<T> {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isLive, setIsLive] = useState(false);

  const refetch = useCallback(async () => {
    try {
      const result = await fetcher();
      setData(result);
      setIsLive(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('API unavailable'));
      setIsLive(false);
      setData(fallback);
    } finally {
      setLoading(false);
    }
  }, [fetcher, fallback]);

  useEffect(() => {
    refetch();

    if (pollInterval && pollInterval > 0) {
      const interval = setInterval(() => void refetch(), pollInterval);
      return () => clearInterval(interval);
    }
  }, [refetch, pollInterval]);

  return { data, loading, error, isLive, refetch };
}
