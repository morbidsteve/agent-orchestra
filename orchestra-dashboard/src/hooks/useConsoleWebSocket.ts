import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  WsConsoleMessage,
  WsExecutionSnapshotMessage,
  Screenshot,
} from '../lib/types.ts';

export type ExecutionWsStatus = 'running' | 'completed' | 'failed' | null;

export interface UseConsoleWebSocketReturn {
  messages: WsConsoleMessage[];
  connected: boolean;
  currentPhase: string | null;
  agentStatuses: Record<string, { visualStatus: string; currentTask: string }>;
  screenshots: Screenshot[];
  businessEval: Record<string, unknown> | null;
  executionStatus: ExecutionWsStatus;
}

export function useConsoleWebSocket(conversationId: string | null): UseConsoleWebSocketReturn {
  const [messages, setMessages] = useState<WsConsoleMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Record<string, { visualStatus: string; currentTask: string }>>({});
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [businessEval, setBusinessEval] = useState<Record<string, unknown> | null>(null);
  const [executionStatus, setExecutionStatus] = useState<ExecutionWsStatus>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMessage = useCallback((msg: WsConsoleMessage) => {
    switch (msg.type) {
      case 'output':
        // Backend sends { type: 'output', line: string, phase: string }
        // Convert to console-text so downstream consumers see a unified type
        setMessages(prev => [...prev, {
          type: 'console-text' as const,
          text: msg.line,
          messageId: `output-${Date.now()}-${Math.random()}`,
        }]);
        break;
      case 'complete':
        setExecutionStatus(msg.status === 'completed' ? 'completed' : 'failed');
        setMessages(prev => [...prev, msg]);
        break;
      case 'agent-status':
        setMessages(prev => [...prev, msg]);
        setAgentStatuses(prev => ({
          ...prev,
          [msg.agentRole]: {
            visualStatus: msg.visualStatus,
            currentTask: msg.currentTask,
          },
        }));
        break;
      case 'screenshot':
        setMessages(prev => [...prev, msg]);
        setScreenshots(prev => [...prev, msg.screenshot]);
        break;
      case 'business-eval':
        setMessages(prev => [...prev, msg]);
        setBusinessEval({ section: msg.section, status: msg.status, data: msg.data });
        break;
      case 'execution-start':
        setMessages(prev => [...prev, msg]);
        setCurrentPhase('plan');
        setExecutionStatus('running');
        break;
      case 'execution-snapshot': {
        const snap = (msg as WsExecutionSnapshotMessage).execution;
        if (snap) {
          if (snap.status === 'completed') {
            setExecutionStatus('completed');
          } else if (snap.status === 'failed') {
            setExecutionStatus('failed');
          } else if (snap.status === 'running') {
            setExecutionStatus('running');
          }
          const runningStep = snap.pipeline?.find((s) => s.status === 'running');
          if (runningStep) {
            setCurrentPhase(runningStep.phase);
          }
        }
        break;
      }
      case 'agent-spawn':
      case 'agent-output':
      case 'agent-complete':
      case 'file-activity':
        // Pass through to messages array for downstream consumption (e.g. useDynamicAgents)
        setMessages(prev => [...prev, msg]);
        break;
      default:
        setMessages(prev => [...prev, msg]);
        break;
    }
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/console/${encodeURIComponent(conversationId)}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data as string) as WsConsoleMessage;
        handleMessage(msg);
      };

      ws.onclose = () => {
        setConnected(false);
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
      // Reset all state in cleanup so next conversationId starts fresh
      setMessages([]);
      setConnected(false);
      setCurrentPhase(null);
      setAgentStatuses({});
      setScreenshots([]);
      setBusinessEval(null);
      setExecutionStatus(null);
    };
  }, [conversationId, handleMessage]);

  return {
    messages,
    connected,
    currentPhase,
    agentStatuses,
    screenshots,
    businessEval,
    executionStatus,
  };
}
