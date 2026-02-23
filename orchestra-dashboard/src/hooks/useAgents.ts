import { useMemo } from 'react';
import { useOrchestra } from '../context/OrchestraContext.tsx';

export function useAgents() {
  const { agents } = useOrchestra();

  const busyCount = useMemo(
    () => agents.filter(a => a.status === 'busy').length,
    [agents],
  );

  const onlineCount = useMemo(
    () => agents.filter(a => a.status !== 'offline').length,
    [agents],
  );

  return { agents, busyCount, onlineCount };
}
