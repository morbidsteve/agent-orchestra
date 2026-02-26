import { ConversationPanel } from '../components/features/console/ConversationPanel.tsx';
import { ContextPanel } from '../components/features/console/ContextPanel.tsx';
import type { Conversation, ConversationMessage, WsConsoleMessage, DynamicAgent, FileTreeNode } from '../lib/types.ts';
import type { ExecutionWsStatus, PendingClarification } from '../hooks/useConsoleWebSocket.ts';

interface ConsolePageProps {
  conversation: Conversation | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  onSend: (text: string) => void;
  onClarificationReply: (answer: string) => void;
  executionId: string | null;
  wsMessages: WsConsoleMessage[];
  executionStatus: ExecutionWsStatus;
  fileTree: FileTreeNode[];
  activeFiles: string[];
  dynamicAgents: DynamicAgent[];
  pendingQuestion: PendingClarification | null;
}

export function ConsolePage({
  conversation,
  messages,
  isLoading,
  onSend,
  onClarificationReply,
  executionId,
  wsMessages,
  executionStatus,
  fileTree,
  activeFiles,
  dynamicAgents,
  pendingQuestion,
}: ConsolePageProps) {
  return (
    <div className="flex h-full">
      <div className="w-3/5 flex flex-col border-r border-surface-600">
        <ConversationPanel
          messages={messages}
          onSend={onSend}
          isLoading={isLoading}
          onClarificationReply={onClarificationReply}
          pendingQuestion={pendingQuestion}
        />
      </div>
      <div className="w-2/5 flex flex-col">
        <ContextPanel
          conversation={conversation}
          executionId={executionId}
          wsMessages={wsMessages}
          executionStatus={executionStatus}
          fileTree={fileTree}
          activeFiles={activeFiles}
          dynamicAgents={dynamicAgents}
        />
      </div>
    </div>
  );
}
