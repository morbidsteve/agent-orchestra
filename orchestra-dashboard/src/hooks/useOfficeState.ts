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

/** Color lookup for known agent roles. */
const ROLE_COLORS: Record<string, string> = {
  developer: '#3b82f6',
  'developer-2': '#06b6d4',
  tester: '#22c55e',
  devsecops: '#f97316',
  'business-dev': '#a855f7',
};

/** Icon lookup for known agent roles. */
const ROLE_ICONS: Record<string, string> = {
  developer: 'Terminal',
  'developer-2': 'Code',
  tester: 'FlaskConical',
  devsecops: 'Shield',
  'business-dev': 'Briefcase',
};

/** Derive a human-readable name from a role slug (e.g. "business-dev" -> "Business Dev"). */
function roleToName(role: string): string {
  return role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Create an AgentNode dynamically for a given role. */
function createAgentNode(
  role: string,
  visualStatus: AgentVisualStatus = 'idle',
  currentTask = '',
): AgentNode {
  return {
    role,
    name: roleToName(role),
    color: ROLE_COLORS[role] || '#6b7280',
    icon: ROLE_ICONS[role] || 'Bot',
    visualStatus,
    currentTask,
  };
}

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
        setAgents(prev => {
          const idx = prev.findIndex(a => a.role === msg.agentRole);
          if (idx >= 0) {
            // Update existing agent
            const updated = [...prev];
            updated[idx] = {
              ...updated[idx],
              visualStatus: msg.visualStatus as AgentVisualStatus,
              currentTask: msg.currentTask,
            };
            return updated;
          }
          // Create new agent dynamically
          const index = prev.length;
          calculateAgentPositions(index + 1);
          return [
            ...prev,
            createAgentNode(
              msg.agentRole,
              msg.visualStatus as AgentVisualStatus,
              msg.currentTask,
            ),
          ];
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

        // Build agents dynamically from pipeline steps
        const agentMap = new Map<string, AgentNode>();
        let runningPhase: string | null = null;
        const initialConnections: AgentConnection[] = [];

        execution.pipeline.forEach((step, index) => {
          const agentRole = step.agentRole || PHASE_AGENTS[step.phase] || 'developer';

          // Ensure agent exists in the map
          if (!agentMap.has(agentRole)) {
            agentMap.set(agentRole, createAgentNode(agentRole));
          }

          const agent = agentMap.get(agentRole)!;

          if (step.status === 'running') {
            runningPhase = step.phase;
            agentMap.set(agentRole, {
              ...agent,
              visualStatus: 'working',
              currentTask: `Executing ${step.phase} phase`,
            });
          } else if (step.status === 'completed') {
            if (agent.visualStatus === 'idle') {
              agentMap.set(agentRole, {
                ...agent,
                visualStatus: 'done',
                currentTask: '',
              });
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

        const initialAgents = [...agentMap.values()];
        // Prime the layout engine with the agent count
        calculateAgentPositions(initialAgents.length);

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
      if (cancelled) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) { ws.close(); return; }
      };

      ws.onmessage = (event: MessageEvent) => {
        if (cancelled) return;
        const msg = JSON.parse(event.data as string) as WsConsoleMessage;
        handleMessage(msg);
      };

      ws.onclose = () => {
        if (cancelled) return;
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
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => ws.close();
        }
      }
    };
  }, [executionId, handleMessage]);

  return {
    agents,
    connections,
    currentPhase,
    executionId,
  };
}
