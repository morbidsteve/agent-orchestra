export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'queued';
export type PipelinePhase = 'plan' | 'develop' | 'test' | 'security' | 'report';
export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
export type AgentRole = string;
export type AgentStatus = 'idle' | 'busy' | 'offline';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingType = 'security' | 'quality' | 'performance' | 'compliance';
export type FindingStatus = 'open' | 'resolved' | 'dismissed';
export type WorkflowType = 'full-pipeline' | 'code-review' | 'security-audit' | 'feature-eval' | 'quick-fix';

export type ProjectSourceType = 'local' | 'git' | 'new';

export interface ProjectSource {
  type: ProjectSourceType;
  path: string;
}

export interface PipelineStep {
  phase: PipelinePhase;
  status: PhaseStatus;
  agentRole: AgentRole | null;
  startedAt: string | null;
  completedAt: string | null;
  output: string[];
}

export interface AgentActivity {
  id: string;
  agentRole: AgentRole;
  action: string;
  output: string[];
  filesModified: string[];
  startedAt: string;
  completedAt: string | null;
  status: PhaseStatus;
}

export interface Execution {
  id: string;
  workflow: WorkflowType;
  task: string;
  status: ExecutionStatus;
  model: string;
  target: string;
  projectSource?: ProjectSource;
  resolvedProjectPath?: string;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  pipeline: PipelineStep[];
  activities: AgentActivity[];
  findings: string[]; // finding IDs
}

export interface AgentInfo {
  role: AgentRole;
  name: string;
  description: string;
  status: AgentStatus;
  capabilities: string[];
  tools: string[];
  color: string;
  icon: string;
  isCustom?: boolean;
  currentExecution: string | null;
  completedTasks: number;
  successRate: number;
}

export interface Finding {
  id: string;
  executionId: string;
  type: FindingType;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  file: string;
  line: number | null;
  remediation: string;
  agent: AgentRole;
  createdAt: string;
}

export interface Workflow {
  type: WorkflowType;
  name: string;
  description: string;
  phases: PipelinePhase[];
  icon: string;
  estimatedDuration: string;
}

export interface GitHubAuthInfo {
  authenticated: boolean;
  username: string | null;
  error?: string;
}

export interface ClaudeAuthInfo {
  authenticated: boolean;
  status?: string;
  error?: string;
}

export interface AuthStatus {
  github: GitHubAuthInfo;
  claude: ClaudeAuthInfo;
}

export interface GitHubLoginResponse {
  deviceCode: string | null;
  verificationUrl: string | null;
  status: string;
}

export interface GitHubLoginStatus {
  status: string;
  deviceCode?: string | null;
  username?: string | null;
  error?: string | null;
}

export interface OrchestraState {
  executions: Execution[];
  agents: AgentInfo[];
  findings: Finding[];
  workflows: Workflow[];
  authStatus: AuthStatus | null;
  isLive: boolean;
}

export interface OrchestraActions {
  startExecution: (workflow: WorkflowType, task: string, model: string, target: string, projectSource: ProjectSource) => Promise<string>;
  createAgent: (params: { name: string; description: string; capabilities: string[]; tools: string[]; color: string; icon: string }) => Promise<void>;
  deleteAgent: (role: string) => Promise<void>;
  refetch: () => void;
}

export interface BrowseResponse {
  current: string;
  parent: string | null;
  directories: string[];
  truncated: boolean;
}
