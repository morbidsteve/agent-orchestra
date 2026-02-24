import { createContext, useContext, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { OrchestraState, OrchestraActions, WorkflowType, ProjectSource, AuthStatus } from '../lib/types';
import { mockState } from '../lib/mockData';
import { WORKFLOWS } from '../lib/constants';
import { useApiData } from '../hooks/useApiData';
import { fetchExecutions, fetchAgents, fetchFindings, fetchAuthStatus, createExecution as apiCreateExecution, createAgent as apiCreateAgent, deleteAgent as apiDeleteAgent } from '../lib/api';

interface OrchestraContextValue extends OrchestraState, OrchestraActions {}

const OrchestraContext = createContext<OrchestraContextValue | null>(null);

export function OrchestraProvider({ children, initialState }: { children: ReactNode; initialState?: OrchestraState }) {
  // When initialState is provided (tests), use it directly without API polling.
  // The useApiData hook always runs (React rules of hooks), but with no pollInterval
  // and the fetcher will fail in test environments, so it falls back to the provided data.
  const useApi = !initialState;

  const fallback = initialState ?? mockState;

  const executionsFetcher = useCallback(() => fetchExecutions(), []);
  const agentsFetcher = useCallback(() => fetchAgents(), []);
  const findingsFetcher = useCallback(() => fetchFindings(), []);
  const authStatusFetcher = useCallback(() => fetchAuthStatus(), []);

  const {
    data: executions,
    isLive: executionsLive,
    refetch: refetchExecutions,
  } = useApiData(executionsFetcher, fallback.executions, useApi ? 5000 : undefined);

  const {
    data: agents,
    refetch: refetchAgents,
  } = useApiData(agentsFetcher, fallback.agents, useApi ? 5000 : undefined);

  const {
    data: findings,
    refetch: refetchFindings,
  } = useApiData(findingsFetcher, fallback.findings, useApi ? 10000 : undefined);

  const {
    data: authStatus,
    refetch: refetchAuthStatus,
  } = useApiData<AuthStatus | null>(authStatusFetcher, fallback.authStatus, useApi ? 30000 : undefined);

  const isLive = useApi && executionsLive;

  const refetch = useCallback(() => {
    refetchExecutions();
    refetchAgents();
    refetchFindings();
  }, [refetchExecutions, refetchAgents, refetchFindings]);

  const startExecution = useCallback(async (
    workflow: WorkflowType, task: string, model: string, target: string, projectSource: ProjectSource,
  ): Promise<string> => {
    if (isLive) {
      // Use real API
      const execution = await apiCreateExecution({ workflow, task, model, target, projectSource });
      refetch();
      return execution.id;
    }

    // Fallback: local creation (mock mode)
    const id = `exec-${String(executions.length + 1).padStart(3, '0')}`;
    return id;
  }, [isLive, executions.length, refetch]);

  const createAgent = useCallback(async (params: {
    name: string; description: string; capabilities: string[]; tools: string[]; color: string; icon: string;
  }): Promise<void> => {
    await apiCreateAgent(params);
    refetchAgents();
  }, [refetchAgents]);

  const deleteAgent = useCallback(async (role: string): Promise<void> => {
    await apiDeleteAgent(role);
    refetchAgents();
  }, [refetchAgents]);

  const contextValue = useMemo<OrchestraContextValue>(() => ({
    executions,
    agents,
    findings,
    workflows: WORKFLOWS,
    authStatus,
    isLive,
    startExecution,
    createAgent,
    deleteAgent,
    refetch,
    refetchAuthStatus,
  }), [executions, agents, findings, authStatus, isLive, startExecution, createAgent, deleteAgent, refetch, refetchAuthStatus]);

  return (
    <OrchestraContext.Provider value={contextValue}>
      {children}
    </OrchestraContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOrchestra(): OrchestraContextValue {
  const context = useContext(OrchestraContext);
  if (!context) {
    throw new Error('useOrchestra must be used within an OrchestraProvider');
  }
  return context;
}
