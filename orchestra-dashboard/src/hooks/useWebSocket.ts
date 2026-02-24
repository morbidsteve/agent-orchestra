import { useState, useEffect, useRef, useCallback } from 'react';

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

export type WsMessage = WsOutputMessage | WsPhaseMessage | WsFindingMessage | WsCompleteMessage | WsClarificationMessage | WsExecutionSnapshotMessage;

interface UseWebSocketResult {
  lines: string[];
  currentPhase: string | null;
  status: string | null;
  connected: boolean;
  pendingQuestion: WsClarificationMessage | null;
  sendAnswer: (questionId: string, answer: string) => void;
}

export function useWebSocket(executionId: string | null): UseWebSocketResult {
  const [lines, setLines] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<WsClarificationMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  return { lines, currentPhase, status, connected, pendingQuestion, sendAnswer };
}
