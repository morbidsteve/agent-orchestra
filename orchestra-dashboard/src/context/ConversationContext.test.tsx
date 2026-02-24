import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import { ConversationProvider, useConversationContext } from './ConversationContext.tsx';
import type { ReactNode } from 'react';
import type { Conversation } from '../lib/types.ts';

// Mock the API module
vi.mock('../lib/api.ts', () => ({
  fetchConversations: vi.fn(),
  fetchConversation: vi.fn(),
  createConversation: vi.fn(),
  sendMessage: vi.fn(),
}));

// Import mocked functions after vi.mock
import {
  fetchConversations,
  fetchConversation,
  createConversation,
  sendMessage as apiSendMessage,
} from '../lib/api.ts';

const mockFetchConversations = vi.mocked(fetchConversations);
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

function makeConversation(overrides?: Partial<Conversation>): Conversation {
  return {
    id: 'conv-001',
    messages: [
      {
        id: 'msg-001',
        role: 'user',
        contentType: 'text',
        text: 'Hello',
        timestamp: '2026-02-24T10:00:00Z',
      },
      {
        id: 'msg-002',
        role: 'orchestra',
        contentType: 'text',
        text: 'Hi there!',
        timestamp: '2026-02-24T10:00:01Z',
      },
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
  return <ConversationProvider>{children}</ConversationProvider>;
}

describe('ConversationContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    // Default: no conversations on the server
    mockFetchConversations.mockResolvedValue([]);
  });

  it('renders children inside the provider', () => {
    render(
      <ConversationProvider>
        <div data-testid="child">Hello</div>
      </ConversationProvider>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('throws when useConversationContext is used outside provider', () => {
    // Suppress console.error for this expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useConversationContext());
    }).toThrow('useConversationContext must be used within a ConversationProvider');
    spy.mockRestore();
  });

  it('provides default initial state', async () => {
    const { result } = renderHook(() => useConversationContext(), { wrapper });

    // Wait for the restore effect to settle
    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalledTimes(1);
    });

    expect(result.current.conversation).toBeNull();
    expect(result.current.conversations).toEqual([]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.model).toBe('sonnet');
  });

  it('startConversation calls createConversation API and updates state', async () => {
    const newConv = makeConversation({ id: 'conv-new' });
    mockCreateConversation.mockResolvedValue(newConv);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    // Wait for mount effect
    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.startConversation('Build me a website');
    });

    expect(mockCreateConversation).toHaveBeenCalledWith({
      text: 'Build me a website',
      projectSource: undefined,
      model: 'sonnet',
    });
    expect(result.current.conversation).toEqual(newConv);
    expect(result.current.conversations).toContainEqual(newConv);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('startConversation uses provided model override', async () => {
    const newConv = makeConversation({ id: 'conv-opus', model: 'opus' });
    mockCreateConversation.mockResolvedValue(newConv);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.startConversation('Review my code', undefined, 'opus');
    });

    expect(mockCreateConversation).toHaveBeenCalledWith({
      text: 'Review my code',
      projectSource: undefined,
      model: 'opus',
    });
    expect(result.current.conversation).toEqual(newConv);
  });

  it('startConversation sets error on API failure', async () => {
    mockCreateConversation.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.startConversation('Fail me');
    });

    expect(result.current.conversation).toBeNull();
    expect(result.current.error).toBe('Network error');
    expect(result.current.isLoading).toBe(false);
  });

  it('sendMessage calls API and updates conversation', async () => {
    const conv = makeConversation();
    mockCreateConversation.mockResolvedValue(conv);

    const updatedConv = makeConversation({
      messages: [
        ...conv.messages,
        {
          id: 'msg-003',
          role: 'user',
          contentType: 'text',
          text: 'What next?',
          timestamp: '2026-02-24T10:01:00Z',
        },
      ],
    });
    mockApiSendMessage.mockResolvedValue(updatedConv);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    // First start a conversation so we have an active one
    await act(async () => {
      await result.current.startConversation('Hello');
    });

    // Now send a follow-up message
    await act(async () => {
      await result.current.sendMessage('What next?');
    });

    expect(mockApiSendMessage).toHaveBeenCalledWith('conv-001', { text: 'What next?' });
    expect(result.current.conversation).toEqual(updatedConv);
    expect(result.current.messages).toHaveLength(3);
  });

  it('sendMessage sets error when no active conversation', async () => {
    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.sendMessage('orphan message');
    });

    expect(result.current.error).toBe('No active conversation');
    expect(mockApiSendMessage).not.toHaveBeenCalled();
  });

  it('switchConversation loads a different conversation', async () => {
    const conv2 = makeConversation({ id: 'conv-002' });
    mockFetchConversation.mockResolvedValue(conv2);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.switchConversation('conv-002');
    });

    expect(mockFetchConversation).toHaveBeenCalledWith('conv-002');
    expect(result.current.conversation?.id).toBe('conv-002');
  });

  it('newConversation clears state and localStorage', async () => {
    const conv = makeConversation();
    mockCreateConversation.mockResolvedValue(conv);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    // Start a conversation
    await act(async () => {
      await result.current.startConversation('Hello');
    });

    expect(result.current.conversation).not.toBeNull();

    // Clear it
    act(() => {
      result.current.newConversation();
    });

    expect(result.current.conversation).toBeNull();
    expect(result.current.error).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('orchestra-active-conversation');
  });

  it('persists conversation id to localStorage when conversation changes', async () => {
    const conv = makeConversation({ id: 'conv-persist' });
    mockCreateConversation.mockResolvedValue(conv);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    await act(async () => {
      await result.current.startConversation('Persist this');
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'orchestra-active-conversation',
      'conv-persist',
    );
  });

  it('restores conversation from localStorage on mount', async () => {
    const conv = makeConversation({ id: 'conv-saved' });
    localStorageMock.getItem.mockReturnValue('conv-saved');
    mockFetchConversations.mockResolvedValue([conv]);
    mockFetchConversation.mockResolvedValue(conv);

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(result.current.conversation?.id).toBe('conv-saved');
    });

    expect(mockFetchConversation).toHaveBeenCalledWith('conv-saved');
  });

  it('removes stale localStorage entry if conversation not found on server', async () => {
    localStorageMock.getItem.mockReturnValue('conv-gone');
    mockFetchConversations.mockResolvedValue([]); // conv-gone is not in the list

    renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('orchestra-active-conversation');
    });
  });

  it('setModel updates the model', async () => {
    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalled();
    });

    expect(result.current.model).toBe('sonnet');

    act(() => {
      result.current.setModel('opus');
    });

    expect(result.current.model).toBe('opus');
  });

  it('refreshConversations fetches latest list from server', async () => {
    const conv = makeConversation({ id: 'conv-refresh' });
    mockFetchConversations
      .mockResolvedValueOnce([]) // initial mount
      .mockResolvedValueOnce([conv]); // refresh

    const { result } = renderHook(() => useConversationContext(), { wrapper });

    await waitFor(() => {
      expect(mockFetchConversations).toHaveBeenCalledTimes(1);
    });

    expect(result.current.conversations).toEqual([]);

    await act(async () => {
      await result.current.refreshConversations();
    });

    expect(result.current.conversations).toEqual([conv]);
    expect(mockFetchConversations).toHaveBeenCalledTimes(2);
  });
});
