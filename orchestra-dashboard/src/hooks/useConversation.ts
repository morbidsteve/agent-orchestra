import { useState, useCallback } from 'react';
import { createConversation, sendMessage as apiSendMessage } from '../lib/api.ts';
import type { Conversation, ConversationMessage, ProjectSource } from '../lib/types.ts';

export interface UseConversationReturn {
  conversation: Conversation | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  startConversation: (text: string, projectSource?: ProjectSource, model?: string) => Promise<void>;
  model: string;
  setModel: (model: string) => void;
}

export function useConversation(): UseConversationReturn {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('sonnet');

  const startConversation = useCallback(async (text: string, projectSource?: ProjectSource, selectedModel?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const conv = await createConversation({
        text,
        projectSource,
        model: selectedModel ?? model,
      });
      setConversation(conv);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [model]);

  const sendMessage = useCallback(async (text: string) => {
    if (!conversation) {
      setError('No active conversation');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updated = await apiSendMessage(conversation.id, { text });
      setConversation(updated);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [conversation]);

  const messages = conversation?.messages ?? [];

  return {
    conversation,
    messages,
    isLoading,
    error,
    sendMessage,
    startConversation,
    model,
    setModel,
  };
}
