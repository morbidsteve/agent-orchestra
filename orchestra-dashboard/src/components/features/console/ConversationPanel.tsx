import { useRef, useEffect } from 'react';
import type { ConversationMessage } from '../../../lib/types.ts';
import type { PendingClarification } from '../../../hooks/useConsoleWebSocket.ts';
import { useSessionContext } from '../../../context/SessionContext.tsx';
import { MessageBubble } from './MessageBubble.tsx';
import { ClarificationCard } from './ClarificationCard.tsx';
import { ConsoleInput } from './ConsoleInput.tsx';
import { SessionConfigBar } from './SessionConfigBar.tsx';

interface ConversationPanelProps {
  messages: ConversationMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  onClarificationReply?: (answer: string) => void;
  pendingQuestion?: PendingClarification | null;
}

export function ConversationPanel({
  messages,
  onSend,
  isLoading,
  onClarificationReply,
  pendingQuestion,
}: ConversationPanelProps) {
  const { model, setModel, githubUrl, setGithubUrl, folderPath, setFolderPath } = useSessionContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const hasConversation = messages.length > 0;

  return (
    <div className="flex flex-col h-full">
      {hasConversation ? (
        <>
          {/* Compact config bar at top */}
          <SessionConfigBar
            model={model}
            githubUrl={githubUrl}
            folderPath={folderPath}
            hasConversation
            onModelChange={setModel}
            onGithubUrlChange={setGithubUrl}
            onFolderPathChange={setFolderPath}
          />

          {/* Message list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                onClarificationReply={onClarificationReply}
              />
            ))}
          </div>
        </>
      ) : (
        /* Setup config filling the empty conversation area */
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <SessionConfigBar
            model={model}
            githubUrl={githubUrl}
            folderPath={folderPath}
            hasConversation={false}
            onModelChange={setModel}
            onGithubUrlChange={setGithubUrl}
            onFolderPathChange={setFolderPath}
          />
        </div>
      )}

      {/* Pending clarification card */}
      {pendingQuestion && onClarificationReply && (
        <div className="px-4 pb-3">
          <ClarificationCard
            question={pendingQuestion.question}
            options={pendingQuestion.options}
            required={pendingQuestion.required}
            onReply={onClarificationReply}
          />
        </div>
      )}

      {/* Input bar */}
      <ConsoleInput
        onSend={onSend}
        disabled={isLoading}
      />
    </div>
  );
}
