import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  AgentNode,
  AgentConnection,
  OfficeState,
  AgentVisualStatus,
  WsConsoleMessage,
  DynamicAgent,
} from '../lib/types.ts';
import { fetchExecution } from '../lib/api.ts';
import { calculateAgentPositions } from '../lib/layoutEngine.ts';

/** Maps backend pipeline phase names to agent roles for office visualization. */
const PHASE_AGENTS: Record<string, string> = {
  plan: 'developer',
  develop: 'developer',
  'develop-2': 'developer-2',
  test: 'tester',
  security: 'devsecops',
  'business-eval': 'business-dev',
  report: 'developer',
};

const DEFAULT_AGENTS: AgentNode[] = [
  { role: 'developer', name: 'Developer', color: '#3b82f6', icon: 'Terminal', visualStatus: 'idle', currentTask: '' },
  { role: 'developer-2', name: 'Developer 2', color: '#06b6d4', icon: 'Code', visualStatus: 'idle', currentTask: '' },
  { role: 'tester', name: 'Tester', color: '#22c55e', icon: 'FlaskConical', visualStatus: 'idle', currentTask: '' },
  { role: 'devsecops', name: 'DevSecOps', color: '#f97316', icon: 'Shield', visualStatus: 'idle', currentTask: '' },
  { role: 'business-dev', name: 'Business Dev', color: '#a855f7', icon: 'Briefcase', visualStatus: 'idle', currentTask: '' },
];

/** Convert a DynamicAgent from a spawn message into an AgentNode for office visualization. */
function dynamicAgentToNode(agent: DynamicAgent): AgentNode {
  // Positions are available via calculateAgentPositions but AgentNode doesn't store x/y;
  // the office component uses the agent index to look up position from the layout engine.
  return {
    role: agent.id, // Use unique ID as role for dynamic agents
    name: agent.name,
    color: agent.color,
    icon: agent.icon,
    visualStatus: agent.status === 'running' ? 'working' : 'idle',
    currentTask: agent.task,
  };
}

/**
 * Derives office visualization state from WebSocket messages for a given execution.
 * Initializes agents in idle state and updates based on agent-status and agent-connection messages.
 * Supports dynamic agents via agent-spawn/agent-output/agent-complete messages,
 * while maintaining backward compatibility with legacy agent-status messages.
 */
export function useOfficeState(executionId: string | null): OfficeState {
  // Use a version key to force state reset when executionId changes
  const versionKey = useMemo(() => executionId ?? 'none', [executionId]);
  const [stateVersion, setStateVersion] = useState(versionKey);
  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  // Reset state when executionId changes by detecting version mismatch during render
  if (stateVersion !== versionKey) {
    setStateVersion(versionKey);
    setAgents([]);
    setConnections([]);
    setCurrentPhase(null);
  }

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMessage = useCallback((msg: WsConsoleMessage) => {
    switch (msg.type) {
      // === Legacy agent-status messages (backward compatibility) ===
      case 'agent-status':
        // Legacy pipeline mode — ensure DEFAULT_AGENTS are populated
        setAgents(prev => {
          // In legacy mode, ensure DEFAULT_AGENTS are present
          const working = prev.length > 0 ? prev : DEFAULT_AGENTS;
          return working.map(agent =>
            agent.role === msg.agentRole
              ? {
                  ...agent,
                  visualStatus: msg.visualStatus as AgentVisualStatus,
                  currentTask: msg.currentTask,
                }
              : agent,
          );
        });
        break;
      case 'agent-connection':
        setConnections(prev => {
          const existing = prev.findIndex(
            c => c.from === msg.from && c.to === msg.to,
          );
          const connection: AgentConnection = {
            from: msg.from,
            to: msg.to,
            label: msg.label,
            active: msg.active,
            dataFlow: msg.dataFlow,
          };
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = connection;
            return updated;
          }
          return [...prev, connection];
        });
        break;

      // === Dynamic agent messages (v0.5.0) ===
      case 'agent-spawn': {
        const spawnAgent = msg.agent;
        setAgents(prev => {
          if (prev.find(a => a.role === spawnAgent.id)) return prev;
          const index = prev.length;
          // Trigger position calculation so layout engine is primed
          calculateAgentPositions(index + 1);
          return [...prev, dynamicAgentToNode(spawnAgent)];
        });
        break;
      }
      case 'agent-output': {
        setAgents(prev =>
          prev.map(agent =>
            agent.role === msg.agentId
              ? { ...agent, visualStatus: 'working' as AgentVisualStatus, currentTask: agent.currentTask || 'Processing...' }
              : agent,
          ),
        );
        break;
      }
      case 'agent-complete': {
        const completeStatus: AgentVisualStatus = msg.status === 'completed' ? 'done' : 'error';
        setAgents(prev =>
          prev.map(agent =>
            agent.role === msg.agentId
              ? { ...agent, visualStatus: completeStatus, currentTask: '' }
              : agent,
          ),
        );
        break;
      }

      case 'phase':
        if ('phase' in msg && 'status' in msg) {
          const phaseMsg = msg as { type: 'phase'; phase: string; status: string };
          if (phaseMsg.status === 'running' && phaseMsg.phase) {
            setCurrentPhase(phaseMsg.phase);
          }
        }
        break;
      case 'execution-start':
        setCurrentPhase('plan');
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!executionId) {
      return;
    }

    // Fetch current execution state to initialize agent visuals from pipeline data.
    // This covers messages that were broadcast before the WebSocket connected.
    let cancelled = false;
    fetchExecution(executionId)
      .then(execution => {
        if (cancelled || !execution?.pipeline) return;

        // Legacy pipeline initialization — use DEFAULT_AGENTS for backward compatibility
        // Legacy pipeline mode — ensure DEFAULT_AGENTS are populated
        const initialAgents = DEFAULT_AGENTS.map(agent => ({ ...agent }));
        let runningPhase: string | null = null;
        const initialConnections: AgentConnection[] = [];

        execution.pipeline.forEach((step, index) => {
          const agentRole = step.agentRole || PHASE_AGENTS[step.phase] || 'developer';
          const agentIdx = initialAgents.findIndex(a => a.role === agentRole);

          if (step.status === 'running') {
            runningPhase = step.phase;
            if (agentIdx >= 0) {
              initialAgents[agentIdx] = {
                ...initialAgents[agentIdx],
                visualStatus: 'working',
                currentTask: `Executing ${step.phase} phase`,
              };
            }
          } else if (step.status === 'completed') {
            if (agentIdx >= 0 && initialAgents[agentIdx].visualStatus === 'idle') {
              initialAgents[agentIdx] = {
                ...initialAgents[agentIdx],
                visualStatus: 'done',
                currentTask: '',
              };
            }
            // Add connection to next phase
            if (index < execution.pipeline.length - 1) {
              const nextStep = execution.pipeline[index + 1];
              const nextAgent = nextStep.agentRole || PHASE_AGENTS[nextStep.phase] || 'developer';
              initialConnections.push({
                from: agentRole,
                to: nextAgent,
                label: `${step.phase} \u2192 ${nextStep.phase}`,
                active: nextStep.status === 'running',
                dataFlow: 'handoff',
              });
            }
          }
        });

        setAgents(initialAgents);
        setConnections(initialConnections);
        if (runningPhase) {
          setCurrentPhase(runningPhase);
        } else {
          // Find the last completed phase
          const lastCompleted = [...execution.pipeline]
            .reverse()
            .find(s => s.status === 'completed');
          if (lastCompleted) setCurrentPhase(lastCompleted.phase);
        }
      })
      .catch(() => {
        // Silently fail — WebSocket updates will provide state
      });

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/${encodeURIComponent(executionId)}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data as string) as WsConsoleMessage;
        handleMessage(msg);
      };

      ws.onclose = () => {
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      clearTimeout(reconnectTimeoutRef.current);
      wsRef.current?.close();
    };
  }, [executionId, handleMessage]);

  return {
    agents,
    connections,
    currentPhase,
    executionId,
  };
}
