import { useCallback } from 'react';
import { ConversationPanel } from '../components/features/console/ConversationPanel.tsx';
import { ContextPanel } from '../components/features/console/ContextPanel.tsx';
import { useConversationContext } from '../context/ConversationContext.tsx';
import { useConsoleWebSocket } from '../hooks/useConsoleWebSocket.ts';

export function ConsolePage() {
  const {
    conversation,
    messages,
    isLoading,
    sendMessage,
    startConversation,
    model,
    setModel,
  } = useConversationContext();

  const conversationId = conversation?.id ?? null;
  const executionId = conversation?.activeExecutionId ?? null;

  const { messages: wsMessages } = useConsoleWebSocket(conversationId);

  const handleSend = useCallback(async (text: string) => {
    if (conversation) {
      await sendMessage(text);
    } else {
      await startConversation(text, undefined, model);
    }
  }, [conversation, sendMessage, startConversation, model]);

  const handleClarificationReply = useCallback(async (answer: string) => {
    await sendMessage(answer);
  }, [sendMessage]);

  return (
    <div className="flex h-full">
      <div className="w-3/5 flex flex-col border-r border-surface-600">
        <ConversationPanel
          messages={messages}
          onSend={handleSend}
          isLoading={isLoading}
          model={model}
          onModelChange={setModel}
          onClarificationReply={handleClarificationReply}
        />
      </div>
      <div className="w-2/5 flex flex-col">
        <ContextPanel
          conversation={conversation}
          executionId={executionId}
          wsMessages={wsMessages}
        />
      </div>
    </div>
  );
}
