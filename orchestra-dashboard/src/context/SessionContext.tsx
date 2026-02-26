import { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { Conversation, ConversationMessage, ProjectSource, SessionSubView } from '../lib/types.ts';
import { fetchConversation, createConversation, sendMessage as apiSendMessage } from '../lib/api.ts';

// ─── State types ──────────────────────────────────────────────────────────────

export interface SessionState {
  id: string;
  conversationId: string | null;
  conversation: Conversation | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  model: string;
  githubUrl: string;
  folderPath: string;
  activeView: SessionSubView;
  label: string;
  createdAt: number;
}

interface SessionsState {
  sessions: SessionState[];
  activeSessionId: string | null;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type SessionAction =
  | { type: 'CREATE_SESSION'; id: string }
  | { type: 'CLOSE_SESSION'; id: string }
  | { type: 'SWITCH_SESSION'; id: string }
  | { type: 'SET_ACTIVE_VIEW'; view: SessionSubView }
  | { type: 'UPDATE_SESSION'; id: string; updates: Partial<SessionState> }
  | { type: 'RESTORE_SESSIONS'; sessions: SessionState[]; activeId: string | null }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_GITHUB_URL'; url: string }
  | { type: 'SET_FOLDER_PATH'; path: string };

// ─── Reducer ──────────────────────────────────────────────────────────────────

function createEmptySession(id: string): SessionState {
  return {
    id,
    conversationId: null,
    conversation: null,
    messages: [],
    isLoading: false,
    error: null,
    model: 'sonnet',
    githubUrl: '',
    folderPath: '',
    activeView: 'console',
    label: 'New Session',
    createdAt: Date.now(),
  };
}

function updateActiveSession(
  state: SessionsState,
  updater: (session: SessionState) => SessionState,
): SessionsState {
  if (!state.activeSessionId) return state;
  return {
    ...state,
    sessions: state.sessions.map(s =>
      s.id === state.activeSessionId ? updater(s) : s,
    ),
  };
}

function sessionReducer(state: SessionsState, action: SessionAction): SessionsState {
  switch (action.type) {
    case 'CREATE_SESSION': {
      const newSession = createEmptySession(action.id);
      return {
        sessions: [...state.sessions, newSession],
        activeSessionId: action.id,
      };
    }

    case 'CLOSE_SESSION': {
      const idx = state.sessions.findIndex(s => s.id === action.id);
      if (idx === -1) return state;

      const remaining = state.sessions.filter(s => s.id !== action.id);

      if (remaining.length === 0) {
        // No sessions left — create a fresh one
        const freshId = crypto.randomUUID();
        const fresh = createEmptySession(freshId);
        return { sessions: [fresh], activeSessionId: freshId };
      }

      // If we closed the active session, switch to nearest sibling
      let newActiveId = state.activeSessionId;
      if (state.activeSessionId === action.id) {
        // Prefer right sibling, then left
        const newIdx = Math.min(idx, remaining.length - 1);
        newActiveId = remaining[newIdx].id;
      }

      return { sessions: remaining, activeSessionId: newActiveId };
    }

    case 'SWITCH_SESSION': {
      if (!state.sessions.find(s => s.id === action.id)) return state;
      return { ...state, activeSessionId: action.id };
    }

    case 'SET_ACTIVE_VIEW':
      return updateActiveSession(state, s => ({ ...s, activeView: action.view }));

    case 'UPDATE_SESSION':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.id ? { ...s, ...action.updates } : s,
        ),
      };

    case 'RESTORE_SESSIONS':
      return {
        sessions: action.sessions,
        activeSessionId: action.activeId,
      };

    case 'SET_MODEL':
      return updateActiveSession(state, s => ({ ...s, model: action.model }));

    case 'SET_GITHUB_URL':
      return updateActiveSession(state, s => ({ ...s, githubUrl: action.url }));

    case 'SET_FOLDER_PATH':
      return updateActiveSession(state, s => ({ ...s, folderPath: action.path }));

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface SessionContextValue {
  session: SessionState | null;
  sessions: SessionState[];
  activeSessionId: string | null;

  createSession: () => string;
  closeSession: (id: string) => void;
  switchSession: (id: string) => void;
  setActiveView: (view: SessionSubView) => void;

  sendMessage: (text: string) => Promise<void>;
  startConversation: (text: string, projectSource?: ProjectSource, model?: string) => Promise<void>;
  refreshConversation: () => Promise<void>;

  model: string;
  setModel: (model: string) => void;
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  folderPath: string;
  setFolderPath: (path: string) => void;

  messages: ConversationMessage[];
  conversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const STORAGE_KEY = 'orchestra-sessions';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, { sessions: [], activeSessionId: null });

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          sessions: Array<{
            id: string;
            conversationId: string | null;
            label: string;
            activeView: SessionSubView;
            model: string;
            githubUrl: string;
            folderPath: string;
            createdAt: number;
          }>;
          activeSessionId: string | null;
        };

        if (parsed.sessions?.length > 0) {
          const restored: SessionState[] = parsed.sessions.map(s => ({
            id: s.id,
            conversationId: s.conversationId,
            conversation: null,
            messages: [],
            isLoading: false,
            error: null,
            model: s.model ?? 'sonnet',
            githubUrl: s.githubUrl ?? '',
            folderPath: s.folderPath ?? '',
            activeView: s.activeView ?? 'console',
            label: s.label ?? 'New Session',
            createdAt: s.createdAt ?? Date.now(),
          }));

          dispatch({ type: 'RESTORE_SESSIONS', sessions: restored, activeId: parsed.activeSessionId });

          // Fetch full conversation data for persisted sessions
          for (const session of restored) {
            if (session.conversationId) {
              fetchConversation(session.conversationId)
                .then(conv => {
                  dispatch({
                    type: 'UPDATE_SESSION',
                    id: session.id,
                    updates: { conversation: conv, messages: conv.messages },
                  });
                })
                .catch(() => {/* silently fail — session stays with null conversation */});
            }
          }
          return;
        }
      }
    } catch {
      /* silently fail */
    }

    // No saved sessions — create initial one
    dispatch({ type: 'CREATE_SESSION', id: crypto.randomUUID() });
  }, []);

  // Persist to localStorage when sessions change
  useEffect(() => {
    if (state.sessions.length === 0) return;
    const serializable = {
      sessions: state.sessions.map(s => ({
        id: s.id,
        conversationId: s.conversationId,
        label: s.label,
        activeView: s.activeView,
        model: s.model,
        githubUrl: s.githubUrl,
        folderPath: s.folderPath,
        createdAt: s.createdAt,
      })),
      activeSessionId: state.activeSessionId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  }, [state.sessions, state.activeSessionId]);

  // Active session
  const activeSession = useMemo(
    () => state.sessions.find(s => s.id === state.activeSessionId) ?? null,
    [state.sessions, state.activeSessionId],
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const createSessionAction = useCallback((): string => {
    const id = crypto.randomUUID();
    dispatch({ type: 'CREATE_SESSION', id });
    return id;
  }, []);

  const closeSession = useCallback((id: string) => {
    dispatch({ type: 'CLOSE_SESSION', id });
  }, []);

  const switchSession = useCallback((id: string) => {
    dispatch({ type: 'SWITCH_SESSION', id });
  }, []);

  const setActiveView = useCallback((view: SessionSubView) => {
    dispatch({ type: 'SET_ACTIVE_VIEW', view });
  }, []);

  const setModel = useCallback((model: string) => {
    dispatch({ type: 'SET_MODEL', model });
  }, []);

  const setGithubUrl = useCallback((url: string) => {
    dispatch({ type: 'SET_GITHUB_URL', url });
  }, []);

  const setFolderPath = useCallback((path: string) => {
    dispatch({ type: 'SET_FOLDER_PATH', path });
  }, []);

  const startConversation = useCallback(async (text: string, projectSource?: ProjectSource, selectedModel?: string) => {
    if (!activeSession) return;

    dispatch({ type: 'UPDATE_SESSION', id: activeSession.id, updates: { isLoading: true, error: null } });

    try {
      const resolvedSource = projectSource
        ?? (activeSession.githubUrl ? { type: 'git' as const, path: activeSession.githubUrl }
          : activeSession.folderPath ? { type: 'local' as const, path: activeSession.folderPath }
            : undefined);

      const conv = await createConversation({
        text,
        projectSource: resolvedSource,
        model: selectedModel ?? activeSession.model,
      });

      dispatch({
        type: 'UPDATE_SESSION',
        id: activeSession.id,
        updates: {
          conversationId: conv.id,
          conversation: conv,
          messages: conv.messages,
          label: text.slice(0, 40) || 'New Session',
          isLoading: false,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start conversation';
      dispatch({ type: 'UPDATE_SESSION', id: activeSession.id, updates: { error: message, isLoading: false } });
    }
  }, [activeSession]);

  const refreshConversation = useCallback(async () => {
    if (!activeSession?.conversationId) return;
    try {
      const conv = await fetchConversation(activeSession.conversationId);
      dispatch({
        type: 'UPDATE_SESSION',
        id: activeSession.id,
        updates: { conversation: conv, messages: conv.messages },
      });
    } catch {
      /* silently fail — stale messages are better than a crash */
    }
  }, [activeSession]);

  const sendMessage = useCallback(async (text: string) => {
    if (!activeSession) return;

    if (!activeSession.conversation) {
      dispatch({ type: 'UPDATE_SESSION', id: activeSession.id, updates: { error: 'No active conversation' } });
      return;
    }

    dispatch({ type: 'UPDATE_SESSION', id: activeSession.id, updates: { isLoading: true, error: null } });

    try {
      const updated = await apiSendMessage(activeSession.conversation.id, { text });
      dispatch({
        type: 'UPDATE_SESSION',
        id: activeSession.id,
        updates: {
          conversation: updated,
          messages: updated.messages,
          isLoading: false,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      dispatch({ type: 'UPDATE_SESSION', id: activeSession.id, updates: { error: message, isLoading: false } });
    }
  }, [activeSession]);

  // ── Context value ───────────────────────────────────────────────────────────

  const value = useMemo<SessionContextValue>(() => ({
    session: activeSession,
    sessions: state.sessions,
    activeSessionId: state.activeSessionId,

    createSession: createSessionAction,
    closeSession,
    switchSession,
    setActiveView,

    sendMessage,
    startConversation,
    refreshConversation,

    model: activeSession?.model ?? 'sonnet',
    setModel,
    githubUrl: activeSession?.githubUrl ?? '',
    setGithubUrl,
    folderPath: activeSession?.folderPath ?? '',
    setFolderPath,

    messages: activeSession?.messages ?? [],
    conversation: activeSession?.conversation ?? null,
    isLoading: activeSession?.isLoading ?? false,
    error: activeSession?.error ?? null,
  }), [
    activeSession, state.sessions, state.activeSessionId,
    createSessionAction, closeSession, switchSession, setActiveView,
    sendMessage, startConversation, refreshConversation,
    setModel, setGithubUrl, setFolderPath,
  ]);

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSessionContext must be used within a SessionProvider');
  }
  return ctx;
}
