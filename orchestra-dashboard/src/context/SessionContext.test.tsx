import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { SessionProvider, useSessionContext } from './SessionContext.tsx';
import type { ReactNode } from 'react';
import type { Conversation } from '../lib/types.ts';

// Mock the API module
vi.mock('../lib/api.ts', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  createConversation: vi.fn(),
  sendMessage: vi.fn(),
}));

import {
  fetchConversation,
  createConversation,
  sendMessage as apiSendMessage,
} from '../lib/api.ts';

const mockFetchConversation = vi.mocked(fetchConversation);
const mockCreateConversation = vi.mocked(createConversation);
const mockApiSendMessage = vi.mocked(apiSendMessage);

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
let uuidCounter = 0;
vi.stubGlobal('crypto', {
  ...crypto,
  randomUUID: () => `sess-${++uuidCounter}`,
});

function makeConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: 'conv-001',
    messages: [
      { id: 'msg-001', role: 'user', contentType: 'text', text: 'Hello', timestamp: '2026-02-24T10:00:00Z' },
      { id: 'msg-002', role: 'orchestra', contentType: 'text', text: 'Hi!', timestamp: '2026-02-24T10:00:01Z' },
    ],
    activeExecutionId: null,
    projectSource: null,
    model: 'sonnet',
    createdAt: '2026-02-24T10:00:00Z',
    updatedAt: '2026-02-24T10:00:01Z',
    ...overrides,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe('SessionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    uuidCounter = 0;
  });

  it('renders children inside the provider', () => {
    render(
      <SessionProvider>
        <div data-testid="child">Hello</div>
      </SessionProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('throws when useSessionContext is used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useSessionContext());
    }).toThrow('useSessionContext must be used within a SessionProvider');
    spy.mockRestore();
  });

  it('creates an initial session on mount', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    expect(result.current.session).not.toBeNull();
    expect(result.current.session?.label).toBe('New Session');
    expect(result.current.session?.activeView).toBe('console');
    expect(result.current.conversation).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.model).toBe('sonnet');
  });

  it('creates a new session and switches to it', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    const firstId = result.current.activeSessionId;

    act(() => {
      result.current.createSession();
    });

    expect(result.current.sessions).toHaveLength(2);
    expect(result.current.activeSessionId).not.toBe(firstId);
  });

  it('switches between sessions', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    const firstId = result.current.activeSessionId!;

    act(() => {
      result.current.createSession();
    });

    const secondId = result.current.activeSessionId!;
    expect(secondId).not.toBe(firstId);

    act(() => {
      result.current.switchSession(firstId);
    });

    expect(result.current.activeSessionId).toBe(firstId);
  });

  it('closes a session and switches to sibling', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    const firstId = result.current.activeSessionId!;

    act(() => {
      result.current.createSession();
    });

    expect(result.current.sessions).toHaveLength(2);

    // Close the second (active) session
    act(() => {
      result.current.closeSession(result.current.activeSessionId!);
    });

    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.activeSessionId).toBe(firstId);
  });

  it('creates a fresh session when closing the last one', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    const originalId = result.current.activeSessionId!;

    act(() => {
      result.current.closeSession(originalId);
    });

    // A new session should have been created
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.activeSessionId).not.toBe(originalId);
  });

  it('sets active view on current session', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    expect(result.current.session?.activeView).toBe('console');

    act(() => {
      result.current.setActiveView('office');
    });

    expect(result.current.session?.activeView).toBe('office');
  });

  it('startConversation calls API and updates session', async () => {
    const conv = makeConversation({ id: 'conv-new' });
    mockCreateConversation.mockResolvedValue(conv);

    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation('Build a website');
    });

    expect(mockCreateConversation).toHaveBeenCalledWith({
      text: 'Build a website',
      projectSource: undefined,
      model: 'sonnet',
    });
    expect(result.current.conversation).toEqual(conv);
    expect(result.current.session?.label).toBe('Build a website');
    expect(result.current.isLoading).toBe(false);
  });

  it('startConversation sets error on API failure', async () => {
    mockCreateConversation.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation('Fail');
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
  });

  it('sendMessage calls API and updates conversation', async () => {
    const conv = makeConversation();
    mockCreateConversation.mockResolvedValue(conv);

    const updatedConv = makeConversation({
      messages: [
        ...conv.messages,
        { id: 'msg-003', role: 'user', contentType: 'text', text: 'What next?', timestamp: '2026-02-24T10:01:00Z' },
      ],
    });
    mockApiSendMessage.mockResolvedValue(updatedConv);

    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    await act(async () => {
      await result.current.startConversation('Hello');
    });

    await act(async () => {
      await result.current.sendMessage('What next?');
    });

    expect(mockApiSendMessage).toHaveBeenCalledWith('conv-001', { text: 'What next?' });
    expect(result.current.messages).toHaveLength(3);
  });

  it('sendMessage sets error when no conversation exists', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    await act(async () => {
      await result.current.sendMessage('orphan');
    });

    expect(result.current.error).toBe('No active conversation');
  });

  it('setModel updates the active session model', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session).not.toBeNull();
    });

    expect(result.current.model).toBe('sonnet');

    act(() => {
      result.current.setModel('opus');
    });

    expect(result.current.model).toBe('opus');
  });

  it('persists sessions to localStorage', async () => {
    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });

    // localStorage.setItem should have been called with the session data
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'orchestra-sessions',
      expect.any(String),
    );

    const stored = JSON.parse(
      localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1],
    );
    expect(stored.sessions).toHaveLength(1);
    expect(stored.activeSessionId).toBe(result.current.activeSessionId);
  });

  it('restores sessions from localStorage on mount', async () => {
    const savedState = JSON.stringify({
      sessions: [
        { id: 'sess-saved', conversationId: 'conv-saved', label: 'Saved Session', activeView: 'console', model: 'opus', githubUrl: '', folderPath: '', createdAt: 1708905600000 },
      ],
      activeSessionId: 'sess-saved',
    });
    localStorageMock.getItem.mockReturnValue(savedState);

    const conv = makeConversation({ id: 'conv-saved' });
    mockFetchConversation.mockResolvedValue(conv);

    const { result } = renderHook(() => useSessionContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.session?.id).toBe('sess-saved');
    });

    expect(result.current.session?.label).toBe('Saved Session');
    expect(result.current.model).toBe('opus');

    // Conversation data should be fetched
    await waitFor(() => {
      expect(mockFetchConversation).toHaveBeenCalledWith('conv-saved');
    });
  });
});
