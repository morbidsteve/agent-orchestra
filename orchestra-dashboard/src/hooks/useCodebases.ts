import { useState, useEffect, useCallback } from 'react';
import type { Codebase } from '../lib/types.ts';
import { fetchCodebases, createCodebase } from '../lib/api.ts';

interface UseCodebasesReturn {
  codebases: Codebase[];
  isLoading: boolean;
  create: (name: string, gitUrl?: string, path?: string) => Promise<Codebase>;
  refresh: () => Promise<void>;
}

export function useCodebases(): UseCodebasesReturn {
  const [codebases, setCodebases] = useState<Codebase[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchCodebases();
      setCodebases(data);
    } catch {
      // API may not be available yet
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (name: string, gitUrl?: string, path?: string): Promise<Codebase> => {
    setIsLoading(true);
    try {
      const codebase = await createCodebase(name, gitUrl, path);
      await refresh();
      return codebase;
    } finally {
      setIsLoading(false);
    }
  }, [refresh]);

  return { codebases, isLoading, create, refresh };
}
