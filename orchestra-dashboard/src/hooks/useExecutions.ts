import { useMemo } from 'react';
import { useOrchestra } from '../context/OrchestraContext.tsx';

export function useExecutions(conversationId?: string | null) {
  const { executions: allExecutions } = useOrchestra();

  // When conversationId is provided, scope to that conversation's executions only.
  // When undefined (not passed), show all executions (backward compat for global pages).
  const executions = useMemo(() => {
    if (conversationId === undefined) return allExecutions;
    if (conversationId === null) return [];
    return allExecutions.filter(e => e.conversationId === conversationId);
  }, [allExecutions, conversationId]);

  const active = useMemo(
    () => executions.filter(e => e.status === 'running' || e.status === 'queued'),
    [executions],
  );

  const completed = useMemo(
    () => executions.filter(e => e.status === 'completed' || e.status === 'failed'),
    [executions],
  );

  /** Most relevant execution: prefer active (running/queued), fall back to most recent. */
  const latest = useMemo(() => {
    const running = executions.filter(e => e.status === 'running' || e.status === 'queued');
    if (running.length > 0) return running[0];
    if (executions.length > 0) return executions[0];
    return null;
  }, [executions]);

  const stats = useMemo(() => ({
    total: executions.length,
    running: executions.filter(e => e.status === 'running').length,
    completed: executions.filter(e => e.status === 'completed').length,
    failed: executions.filter(e => e.status === 'failed').length,
    queued: executions.filter(e => e.status === 'queued').length,
  }), [executions]);

  return { executions, active, completed, latest, stats };
}
