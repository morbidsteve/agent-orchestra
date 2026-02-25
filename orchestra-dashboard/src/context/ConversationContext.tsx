import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Conversation, ConversationMessage, ProjectSource } from '../lib/types.ts';
import { fetchConversations, fetchConversation, createConversation, sendMessage as apiSendMessage } from '../lib/api.ts';

interface ConversationContextValue {
  conversation: Conversation | null;
  conversations: Conversation[];
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  model: string;
  setModel: (model: string) => void;
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  folderPath: string;
  setFolderPath: (path: string) => void;
  sendMessage: (text: string) => Promise<void>;
  startConversation: (text: string, projectSource?: ProjectSource, model?: string) => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  newConversation: () => void;
  refreshConversations: () => Promise<void>;
}

const ConversationContext = createContext<ConversationContextValue | null>(null);

const STORAGE_KEY = 'orchestra-active-conversation';

export function ConversationProvider({ children }: { children: ReactNode }) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState('sonnet');
  const [githubUrl, setGithubUrl] = useState('');
  const [folderPath, setFolderPath] = useState('');

  // Restore active conversation on mount
  useEffect(() => {
    async function restore() {
      try {
        // Fetch all conversations
        const allConvs = await fetchConversations();
        setConversations(allConvs);

        // Try to restore the last active conversation
        const savedId = localStorage.getItem(STORAGE_KEY);
        if (savedId) {
          const found = allConvs.find(c => c.id === savedId);
          if (found) {
            // Fetch full conversation with messages
            const full = await fetchConversation(savedId);
            setConversation(full);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        // Backend might not be available yet, that's OK
      }
    }
    restore();
  }, []);

  // Persist active conversation ID to localStorage
  useEffect(() => {
    if (conversation?.id) {
      localStorage.setItem(STORAGE_KEY, conversation.id);
    }
  }, [conversation?.id]);

  const startConversation = useCallback(async (text: string, projectSource?: ProjectSource, selectedModel?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const resolvedSource = projectSource
        ?? (githubUrl ? { type: 'git' as const, path: githubUrl }
          : folderPath ? { type: 'local' as const, path: folderPath }
          : undefined);
      const conv = await createConversation({
        text,
        projectSource: resolvedSource,
        model: selectedModel ?? model,
      });
      setConversation(conv);
      setConversations(prev => [conv, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start conversation';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [model, githubUrl, folderPath]);

  const sendMessage = useCallback(async (text: string) => {
    if (!conversation) {
      setError('No active conversation');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const updated = await apiSendMessage(conversation.id, {
        text,
      });
      setConversation(updated);
      // Update in conversations list too
      setConversations(prev => prev.map(c => c.id === updated.id ? updated : c));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [conversation]);

  const switchConversation = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const full = await fetchConversation(id);
      setConversation(full);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load conversation';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const newConversation = useCallback(() => {
    setConversation(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const refreshConversations = useCallback(async () => {
    try {
      const allConvs = await fetchConversations();
      setConversations(allConvs);
    } catch {
      // Silently fail
    }
  }, []);

  const value = useMemo<ConversationContextValue>(() => ({
    conversation,
    conversations,
    messages: conversation?.messages ?? [],
    isLoading,
    error,
    model,
    setModel,
    githubUrl,
    setGithubUrl,
    folderPath,
    setFolderPath,
    sendMessage,
    startConversation,
    switchConversation,
    newConversation,
    refreshConversations,
  }), [conversation, conversations, isLoading, error, model, githubUrl, folderPath, sendMessage, startConversation, switchConversation, newConversation, refreshConversations]);

  return (
    <ConversationContext.Provider value={value}>
      {children}
    </ConversationContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConversationContext(): ConversationContextValue {
  const ctx = useContext(ConversationContext);
  if (!ctx) {
    throw new Error('useConversationContext must be used within a ConversationProvider');
  }
  return ctx;
}
