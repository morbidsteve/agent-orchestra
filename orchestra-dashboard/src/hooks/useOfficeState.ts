import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type {
  AgentNode,
  AgentConnection,
  OfficeState,
  AgentVisualStatus,
  WsConsoleMessage,
} from '../lib/types.ts';

const DEFAULT_AGENTS: AgentNode[] = [
  { role: 'developer', name: 'Developer', color: '#3b82f6', icon: 'Terminal', visualStatus: 'idle', currentTask: '' },
  { role: 'developer-2', name: 'Developer 2', color: '#06b6d4', icon: 'Code', visualStatus: 'idle', currentTask: '' },
  { role: 'tester', name: 'Tester', color: '#22c55e', icon: 'FlaskConical', visualStatus: 'idle', currentTask: '' },
  { role: 'devsecops', name: 'DevSecOps', color: '#f97316', icon: 'Shield', visualStatus: 'idle', currentTask: '' },
  { role: 'business-dev', name: 'Business Dev', color: '#a855f7', icon: 'Briefcase', visualStatus: 'idle', currentTask: '' },
];

/**
 * Derives office visualization state from WebSocket messages for a given execution.
 * Initializes agents in idle state and updates based on agent-status and agent-connection messages.
 */
export function useOfficeState(executionId: string | null): OfficeState {
  // Use a version key to force state reset when executionId changes
  const versionKey = useMemo(() => executionId ?? 'none', [executionId]);
  const [stateVersion, setStateVersion] = useState(versionKey);
  const [agents, setAgents] = useState<AgentNode[]>(DEFAULT_AGENTS);
  const [connections, setConnections] = useState<AgentConnection[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);

  // Reset state when executionId changes by detecting version mismatch during render
  if (stateVersion !== versionKey) {
    setStateVersion(versionKey);
    setAgents(DEFAULT_AGENTS);
    setConnections([]);
    setCurrentPhase(null);
  }

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMessage = useCallback((msg: WsConsoleMessage) => {
    switch (msg.type) {
      case 'agent-status':
        setAgents(prev =>
          prev.map(agent =>
            agent.role === msg.agentRole
              ? {
                  ...agent,
                  visualStatus: msg.visualStatus as AgentVisualStatus,
                  currentTask: msg.currentTask,
                }
              : agent,
          ),
        );
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
