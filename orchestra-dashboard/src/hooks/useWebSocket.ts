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

export interface WsClarificationMessage {
  type: 'clarification';
  questionId: string;
  question: string;
  options?: string[];
  required: boolean;
}

export type WsMessage = WsOutputMessage | WsPhaseMessage | WsFindingMessage | WsCompleteMessage | WsClarificationMessage;

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

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws/${encodeURIComponent(executionId)}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
      };

      ws.onmessage = (event: MessageEvent) => {
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
        }
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
    };
  }, [executionId]);

  return { lines, currentPhase, status, connected, pendingQuestion, sendAnswer };
}
