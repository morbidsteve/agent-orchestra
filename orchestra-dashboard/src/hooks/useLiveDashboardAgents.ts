import { useState, useEffect, useMemo } from 'react';
import type { DynamicAgent } from '../lib/types.ts';
import { fetchDynamicAgents } from '../lib/api.ts';

const POLL_INTERVAL = 3000;
const EMPTY_MAP = new Map<string, DynamicAgent[]>();

interface UseLiveDashboardAgentsReturn {
  agentsByExecution: Map<string, DynamicAgent[]>;
  allAgents: DynamicAgent[];
}

async function pollAgents(ids: string[]): Promise<Map<string, DynamicAgent[]>> {
  const results = await Promise.allSettled(
    ids.map((id) => fetchDynamicAgents(id).then((agents) => ({ id, agents }))),
  );

  const nextMap = new Map<string, DynamicAgent[]>();
  for (const result of results) {
    if (result.status === 'fulfilled') {
      nextMap.set(result.value.id, result.value.agents);
    }
  }
  return nextMap;
}

export function useLiveDashboardAgents(activeExecutionIds: string[]): UseLiveDashboardAgentsReturn {
  const [agentsByExecution, setAgentsByExecution] = useState<Map<string, DynamicAgent[]>>(EMPTY_MAP);

  useEffect(() => {
    if (activeExecutionIds.length === 0) {
      return;
    }

    let cancelled = false;

    async function run() {
      const result = await pollAgents(activeExecutionIds);
      if (!cancelled) setAgentsByExecution(result);
    }

    void run();
    const timer = setInterval(() => void run(), POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeExecutionIds]);

  const effectiveMap = useMemo(
    () => (activeExecutionIds.length === 0 ? EMPTY_MAP : agentsByExecution),
    [activeExecutionIds.length, agentsByExecution],
  );

  const allAgents = useMemo(() => {
    const result: DynamicAgent[] = [];
    for (const agents of effectiveMap.values()) {
      result.push(...agents);
    }
    return result;
  }, [effectiveMap]);

  return { agentsByExecution: effectiveMap, allAgents };
}
