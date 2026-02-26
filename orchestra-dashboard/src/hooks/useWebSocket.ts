import { useState, useEffect, useRef, useCallback } from 'react';
import type { WsConsoleMessage } from '../lib/types.ts';

export interface WsOutputMessage {
  type: 'output';
  line: string;
  phase: string;
}

export interface WsPhaseMessage {
  type: 'phase';
  phase: string;
  status: string;
}

export interface WsFindingMessage {
  type: 'finding';
  finding: Record<string, unknown>;
}

export interface WsCompleteMessage {
  type: 'complete';
  status: string;
}

export interface WsExecutionSnapshotMessage {
  type: 'execution-snapshot';
  execution: {
    id: string;
    status: string;
    pipeline: Array<{ phase: string; status: string }>;
  };
}

export interface WsClarificationMessage {
  type: 'clarification';
  questionId: string;
  question: string;
  options?: string[];
  required: boolean;
}

export interface WsClarificationDismissedMessage {
  type: 'clarification-dismissed';
  questionId: string;
}

export interface WsAgentSpawnMessage {
  type: 'agent-spawn';
  agent?: { id?: string; name?: string; task?: string };
  agentId?: string;
  name?: string;
  task?: string;
}

export interface WsAgentOutputMessage {
  type: 'agent-output';
  agentId?: string;
  line: string;
}

export interface WsAgentCompleteMessage {
  type: 'agent-complete';
  agentId?: string;
  name?: string;
  status?: string;
}

export type WsMessage = WsOutputMessage | WsPhaseMessage | WsFindingMessage | WsCompleteMessage | WsClarificationMessage | WsClarificationDismissedMessage | WsExecutionSnapshotMessage | WsAgentSpawnMessage | WsAgentOutputMessage | WsAgentCompleteMessage;

interface UseWebSocketResult {
  lines: string[];
  messages: WsConsoleMessage[];
  currentPhase: string | null;
  status: string | null;
  connected: boolean;
  pendingQuestion: WsClarificationMessage | null;
  sendAnswer: (questionId: string, answer: string) => void;
}

export function useWebSocket(executionId: string | null): UseWebSocketResult {
  const [lines, setLines] = useState<string[]>([]);
  const [messages, setMessages] = useState<WsConsoleMessage[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<WsClarificationMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Reset state when executionId changes (React-approved "adjust state during render" pattern)
  const [prevId, setPrevId] = useState(executionId);
  if (prevId !== executionId) {
    setPrevId(executionId);
    setLines([]);
    setMessages([]);
    setCurrentPhase(null);
    setStatus(null);
    setPendingQuestion(null);
  }

  const sendAnswer = useCallback(function sendAnswer(questionId: string, answer: string) {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'clarification-response',
        questionId,
        answer,
      }));
      setPendingQuestion(null);
    }
  }, []);

  useEffect(() => {
    if (!executionId) return;

    let cleaned = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/${encodeURIComponent(executionId)}`;

    function connect() {
      if (cleaned) return;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cleaned) { ws.close(); return; }
        setConnected(true);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (cleaned) return;
        const msg = JSON.parse(event.data as string) as WsMessage;
        setMessages(prev => [...prev, msg as unknown as WsConsoleMessage]);
        switch (msg.type) {
          case 'output':
            setLines(prev => [...prev, msg.line]);
            setCurrentPhase(msg.phase);
            break;
          case 'phase':
            setCurrentPhase(msg.phase);
            setStatus(msg.status);
            break;
          case 'complete':
            setStatus(msg.status);
            break;
          case 'clarification':
            setPendingQuestion(msg as WsClarificationMessage);
            break;
          case 'clarification-dismissed':
            setPendingQuestion(null);
            break;
          case 'agent-spawn': {
            const spawn = msg as WsAgentSpawnMessage;
            const label = spawn.agent?.name ?? spawn.name ?? spawn.agent?.id ?? spawn.agentId ?? 'agent';
            const task = spawn.agent?.task ?? spawn.task ?? '';
            const spawnText = task ? `[Agent: ${label}] Starting: ${task}` : `[Agent: ${label}] Starting...`;
            setLines(prev => [...prev, spawnText]);
            break;
          }
          case 'agent-output': {
            const ao = msg as WsAgentOutputMessage;
            if (ao.line) {
              setLines(prev => [...prev, ao.line]);
            }
            break;
          }
          case 'agent-complete': {
            const ac = msg as WsAgentCompleteMessage;
            const name = ac.name ?? ac.agentId ?? 'agent';
            setLines(prev => [...prev, `[Agent: ${name}] Completed`]);
            break;
          }
          case 'execution-snapshot': {
            const snap = (msg as WsExecutionSnapshotMessage).execution;
            if (snap) {
              if (snap.status === 'completed') {
                setStatus('completed');
              } else if (snap.status === 'failed') {
                setStatus('failed');
              } else {
                setStatus(snap.status);
              }
              const runningStep = snap.pipeline?.find((s) => s.status === 'running');
              if (runningStep) {
                setCurrentPhase(runningStep.phase);
              }
            }
            break;
          }
        }
      };

      ws.onclose = () => {
        if (cleaned) return;
        setConnected(false);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cleaned = true;
      clearTimeout(reconnectTimeoutRef.current);
      const ws = wsRef.current;
      if (ws) {
        // Only close if the connection is actually open or still connecting
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        } else if (ws.readyState === WebSocket.CONNECTING) {
          // Defer close until after the connection is established to avoid
          // "WebSocket is closed before the connection is established" warning
          ws.onopen = () => ws.close();
        }
      }
    };
  }, [executionId]);

  return { lines, messages, currentPhase, status, connected, pendingQuestion, sendAnswer };
}
