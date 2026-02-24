import type { Execution, AgentInfo, Finding, WorkflowType, ProjectSource, AuthStatus, GitHubLoginResponse, GitHubLoginStatus, BrowseResponse } from './types.ts';
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
