import { useMemo } from 'react';
import { useOrchestra } from '../context/OrchestraContext.tsx';

export function useExecutions() {
  const { executions } = useOrchestra();

  const active = useMemo(
    () => executions.filter(e => e.status === 'running' || e.status === 'queued'),
    [executions],
  );

  const completed = useMemo(
    () => executions.filter(e => e.status === 'completed' || e.status === 'failed'),
    [executions],
  );

  const stats = useMemo(() => ({
    total: executions.length,
    running: executions.filter(e => e.status === 'running').length,
    completed: executions.filter(e => e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed').length,
    queued: executions.filter(e => e.status === 'queued').length,
  }), [executions]);

  return { executions, active, completed, stats };
}
