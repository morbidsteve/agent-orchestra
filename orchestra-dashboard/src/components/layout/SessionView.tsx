import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSessionContext } from '../../context/SessionContext.tsx';
import { useConsoleWebSocket } from '../../hooks/useConsoleWebSocket.ts';
import { useDynamicAgents } from '../../hooks/useDynamicAgents.ts';
import { useOfficeState } from '../../hooks/useOfficeState.ts';
import { useExecutions } from '../../hooks/useExecutions.ts';
import { ConsolePage } from '../../pages/ConsolePage.tsx';
import { AgentOfficePage } from '../../pages/AgentOfficePage.tsx';
import { DashboardPage } from '../../pages/DashboardPage.tsx';

interface SessionViewProps {
  sessionId: string;
}

export function SessionView({ sessionId }: SessionViewProps) {
  const {
    sessions,
    sendMessage,
    startConversation,
    refreshConversation,
  } = useSessionContext();

  const session = sessions.find(s => s.id === sessionId);
  if (!session) return null;

  const conversationId = session.conversationId;
  const conversation = session.conversation;
  const executionId = conversation?.activeExecutionId ?? null;

  return (
    <SessionViewInner
      activeView={session.activeView}
      conversationId={conversationId}
      conversation={conversation}
      executionId={executionId}
      messages={session.messages}
      isLoading={session.isLoading}
      sendMessage={sendMessage}
      startConversation={startConversation}
      onExecutionComplete={refreshConversation}
    />
  );
}

interface SessionViewInnerProps {
  activeView: string;
  conversationId: string | null;
  conversation: import('../../lib/types.ts').Conversation | null;
  executionId: string | null;
  messages: import('../../lib/types.ts').ConversationMessage[];
  isLoading: boolean;
  sendMessage: (text: string) => Promise<void>;
  startConversation: (text: string, projectSource?: import('../../lib/types.ts').ProjectSource, model?: string) => Promise<void>;
  onExecutionComplete: () => Promise<void>;
}

function SessionViewInner({
  activeView,
  conversationId,
  conversation,
  executionId,
  messages,
  isLoading,
  sendMessage,
  startConversation,
  onExecutionComplete,
}: SessionViewInnerProps) {
  const ws = useConsoleWebSocket(conversationId);
  const { agents: dynamicAgents, fileTree, activeFiles } = useDynamicAgents(ws.messages);
  const officeState = useOfficeState(executionId);
  const { latest } = useExecutions();

  // Re-fetch conversation when execution completes so summary messages appear
  const prevStatusRef = useRef(ws.executionStatus);
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = ws.executionStatus;
    if (prev === 'running' && (ws.executionStatus === 'completed' || ws.executionStatus === 'failed')) {
      void onExecutionComplete();
    }
  }, [ws.executionStatus, onExecutionComplete]);

  const handleSend = useCallback(async (text: string) => {
    if (conversation) {
      await sendMessage(text);
    } else {
      await startConversation(text);
    }
  }, [conversation, sendMessage, startConversation]);

  const handleClarificationReply = useCallback((answer: string) => {
    if (ws.pendingQuestion) {
      ws.sendAnswer(ws.pendingQuestion.questionId, answer);
    }
  }, [ws]);

  // Build agent output/files maps for office view
  const { agentOutputMap, agentFilesMap } = useMemo(() => {
    const outputMap = new Map<string, string[]>();
    const filesMap = new Map<string, string[]>();
    for (const agent of dynamicAgents) {
      outputMap.set(agent.id, agent.output);
      filesMap.set(agent.id, [...agent.filesModified, ...agent.filesRead]);
    }
    return { agentOutputMap: outputMap, agentFilesMap: filesMap };
  }, [dynamicAgents]);

  switch (activeView) {
    case 'console':
      return (
        <ConsolePage
          conversation={conversation}
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          onClarificationReply={handleClarificationReply}
          executionId={executionId}
          wsMessages={ws.messages}
          executionStatus={ws.executionStatus}
          fileTree={fileTree}
          activeFiles={activeFiles}
          dynamicAgents={dynamicAgents}
        />
      );
    case 'office':
      return (
        <AgentOfficePage
          officeState={officeState}
          startedAt={latest?.startedAt ?? null}
          agentOutputMap={agentOutputMap}
          agentFilesMap={agentFilesMap}
        />
      );
    case 'dashboard':
      return <DashboardPage conversationId={conversationId} />;
    default:
      return null;
  }
}
