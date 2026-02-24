import { useRef, useEffect } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ConversationMessage } from '../../../lib/types.ts';
import { MessageBubble } from './MessageBubble.tsx';
import { ConsoleInput } from './ConsoleInput.tsx';

interface ConversationPanelProps {
  messages: ConversationMessage[];
  onSend: (text: string) => void;
  isLoading: boolean;
  model: string;
  onModelChange: (model: string) => void;
  onClarificationReply?: (answer: string) => void;
}

export function ConversationPanel({
  messages,
  onSend,
  isLoading,
  model,
  onModelChange,
  onClarificationReply,
}: ConversationPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full">
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-700 mb-4">
              <MessageSquare className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-300 mb-1">Start a conversation...</h3>
            <p className="text-xs text-gray-500 max-w-xs">
              Describe what you want to build, fix, or review. The orchestra will plan and execute with its agent team.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onClarificationReply={onClarificationReply}
            />
          ))
        )}
      </div>

      {/* Input bar */}
      <ConsoleInput
        onSend={onSend}
        disabled={isLoading}
        model={model}
        onModelChange={onModelChange}
      />
    </div>
  );
}
