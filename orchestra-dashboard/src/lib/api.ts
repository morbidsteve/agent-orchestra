import type { Execution, AgentInfo, Finding, WorkflowType, ProjectSource, AuthStatus, GitHubLoginResponse, GitHubLoginStatus, ClaudeLoginResponse, ClaudeLoginStatus, BrowseResponse, Conversation, Screenshot } from './types.ts';
export type { AgentInfo };

const API_BASE = import.meta.env.VITE_API_URL || '';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function fetchExecutions(): Promise<Execution[]> {
  return apiFetch<Execution[]>('/api/executions');
}

export function fetchExecution(id: string): Promise<Execution> {
  return apiFetch<Execution>(`/api/executions/${encodeURIComponent(id)}`);
}

export function createExecution(params: {
  workflow: WorkflowType;
  task: string;
  model: string;
  target: string;
  projectSource: ProjectSource;
}): Promise<Execution> {
  return apiFetch<Execution>('/api/executions', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function fetchAgents(): Promise<AgentInfo[]> {
  return apiFetch<AgentInfo[]>('/api/agents');
}

export function fetchFindings(params?: {
  severity?: string;
  type?: string;
  status?: string;
}): Promise<Finding[]> {
  const searchParams = new URLSearchParams();
  if (params?.severity) searchParams.set('severity', params.severity);
  if (params?.type) searchParams.set('type', params.type);
  if (params?.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  const path = query ? `/api/findings?${query}` : '/api/findings';
  return apiFetch<Finding[]>(path);
}

export function checkHealth(): Promise<{ status: string }> {
  return apiFetch<{ status: string }>('/api/health');
}

export function fetchAuthStatus(): Promise<AuthStatus> {
  return apiFetch<AuthStatus>('/api/auth/status');
}

export function startGithubLogin(): Promise<GitHubLoginResponse> {
  return apiFetch<GitHubLoginResponse>('/api/auth/github/login', { method: 'POST' });
}

export function fetchGithubLoginStatus(): Promise<GitHubLoginStatus> {
  return apiFetch<GitHubLoginStatus>('/api/auth/github/status');
}

export function githubLogout(): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>('/api/auth/github/logout', { method: 'POST' });
}

export function startClaudeLogin(): Promise<ClaudeLoginResponse> {
  return apiFetch<ClaudeLoginResponse>('/api/auth/claude/login', { method: 'POST' });
}

export function fetchClaudeLoginStatus(): Promise<ClaudeLoginStatus> {
  return apiFetch<ClaudeLoginStatus>('/api/auth/claude/status');
}

export function submitClaudeAuthCode(code: string): Promise<{ status: string; error?: string }> {
  return apiFetch<{ status: string; error?: string }>('/api/auth/claude/callback', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function createAgent(params: {
  name: string;
  description: string;
  capabilities: string[];
  tools: string[];
  color: string;
  icon: string;
}): Promise<AgentInfo> {
  return apiFetch<AgentInfo>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function deleteAgent(role: string): Promise<{ deleted: string }> {
  return apiFetch<{ deleted: string }>(`/api/agents/${encodeURIComponent(role)}`, {
    method: 'DELETE',
  });
}

export function browseFilesystem(path?: string): Promise<BrowseResponse> {
  const params = new URLSearchParams();
  if (path) params.set('path', path);
  const query = params.toString();
  return apiFetch<BrowseResponse>(query ? `/api/filesystem/browse?${query}` : '/api/filesystem/browse');
}

// ──────────────────────────────────────────────────────────────────────────────
// Conversations
// ──────────────────────────────────────────────────────────────────────────────

export function fetchConversations(): Promise<Conversation[]> {
  return apiFetch<Conversation[]>('/api/conversations');
}

export function fetchConversation(id: string): Promise<Conversation> {
  return apiFetch<Conversation>(`/api/conversations/${encodeURIComponent(id)}`);
}

export function createConversation(params: {
  text: string;
  projectSource?: ProjectSource;
  model?: string;
}): Promise<Conversation> {
  return apiFetch<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function sendMessage(conversationId: string, params: {
  text: string;
}): Promise<Conversation> {
  return apiFetch<Conversation>(
    `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// System
// ──────────────────────────────────────────────────────────────────────────────

export function triggerSystemUpdate(): Promise<{ status: string; message?: string }> {
  return apiFetch<{ status: string; message?: string }>('/api/system/update', { method: 'POST' });
}

// ──────────────────────────────────────────────────────────────────────────────
// Screenshots
// ──────────────────────────────────────────────────────────────────────────────

export function fetchScreenshots(executionId: string): Promise<Screenshot[]> {
  return apiFetch<Screenshot[]>(`/api/screenshots?execution_id=${encodeURIComponent(executionId)}`);
}

export function getScreenshotImageUrl(id: string): string {
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}/api/screenshots/${encodeURIComponent(id)}/image`;
}

// ──────────────────────────────────────────────────────────────────────────────
// Internal: Question/Answer relay (REST fallback)
// ──────────────────────────────────────────────────────────────────────────────

export function submitQuestionAnswer(questionId: string, answer: string): Promise<{ status: string }> {
  return apiFetch<{ status: string }>(
    `/api/internal/question/${encodeURIComponent(questionId)}/answer`,
    {
      method: 'POST',
      body: JSON.stringify({ answer }),
    },
  );
}
