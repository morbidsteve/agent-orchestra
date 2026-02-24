export type ExecutionStatus = 'running' | 'completed' | 'failed' | 'queued';
export type PipelinePhase = 'plan' | 'develop' | 'develop-2' | 'test' | 'security' | 'business-eval' | 'report';
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
  group: number;
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
  email?: string | null;
  authMethod?: string | null;
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

export interface ClaudeLoginResponse {
  authUrl: string | null;
  status: string;
}

export interface ClaudeLoginStatus {
  status: string;
  authUrl?: string | null;
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
  refetchAuthStatus: () => void;
}

export interface BrowseResponse {
  current: string;
  parent: string | null;
  directories: string[];
  truncated: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Conversation types (Phase 1: Conversational Console)
// ──────────────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'orchestra' | 'system';
export type MessageContentType =
  | 'text'
  | 'clarification'
  | 'execution-start'
  | 'progress'
  | 'screenshot'
  | 'business-eval';

export interface ClarificationPayload {
  question: string;
  options?: string[];
  required: boolean;
}

export interface BusinessEvalPayload {
  section: 'marketResearch' | 'competitiveAnalysis' | 'iceScore' | 'recommendation';
  status: 'market-research' | 'competitive-analysis' | 'scoring' | 'complete';
  data: BusinessEvalData;
}

export interface MarketResearchData {
  summary: string;
  trends: string[];
  marketSize: string;
  sources: { title: string; url: string }[];
}

export interface CompetitorEntry {
  name: string;
  hasFeature: boolean;
  approach: string;
  strengths: string[];
  weaknesses: string[];
}

export interface ICEScoreData {
  impact: number;
  confidence: number;
  ease: number;
  total: number;
  reasoning: string;
}

export interface RecommendationData {
  verdict: 'BUILD' | 'DEFER' | 'INVESTIGATE';
  summary: string;
  risks: string[];
  nextSteps: string[];
}

export type BusinessEvalData =
  | { marketResearch: MarketResearchData }
  | { competitiveAnalysis: CompetitorEntry[] }
  | { iceScore: ICEScoreData }
  | { recommendation: RecommendationData };

export interface ConversationMessage {
  id: string;
  role: MessageRole;
  contentType: MessageContentType;
  text: string;
  timestamp: string;
  clarification?: ClarificationPayload;
  executionRef?: string;
  screenshotRef?: string;
  businessEval?: BusinessEvalPayload;
}

export interface Conversation {
  id: string;
  messages: ConversationMessage[];
  activeExecutionId: string | null;
  projectSource: ProjectSource | null;
  model: string;
  createdAt: string;
  updatedAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Agent Office types (Phase 2)
// ──────────────────────────────────────────────────────────────────────────────

export type AgentVisualStatus = 'idle' | 'working' | 'done' | 'error';

export interface AgentNode {
  role: string;
  name: string;
  color: string;
  icon: string;
  visualStatus: AgentVisualStatus;
  currentTask: string;
}

export interface AgentConnection {
  from: string;
  to: string;
  label: string;
  active: boolean;
  dataFlow: 'handoff' | 'feedback' | 'broadcast';
}

export interface OfficeState {
  agents: AgentNode[];
  connections: AgentConnection[];
  currentPhase: string | null;
  executionId: string | null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Screenshot types (Phase 3)
// ──────────────────────────────────────────────────────────────────────────────

export type ScreenshotType = 'terminal' | 'browser';

export interface Screenshot {
  id: string;
  executionId: string;
  type: ScreenshotType;
  phase: string;
  milestone: string;
  timestamp: string;
  imageUrl?: string;
  terminalLines?: string[];
}

// ──────────────────────────────────────────────────────────────────────────────
// Console WebSocket message types
// ──────────────────────────────────────────────────────────────────────────────

export interface WsConsoleTextMessage {
  type: 'console-text';
  text: string;
  messageId: string;
}

export interface WsClarificationMessage {
  type: 'clarification';
  question: string;
  options?: string[];
  required: boolean;
  messageId: string;
}

export interface WsAgentStatusMessage {
  type: 'agent-status';
  agentRole: string;
  visualStatus: AgentVisualStatus;
  currentTask: string;
}

export interface WsAgentConnectionMessage {
  type: 'agent-connection';
  from: string;
  to: string;
  label: string;
  active: boolean;
  dataFlow: 'handoff' | 'feedback' | 'broadcast';
}

export interface WsScreenshotMessage {
  type: 'screenshot';
  screenshot: Screenshot;
}

export interface WsBusinessEvalMessage {
  type: 'business-eval';
  status: string;
  section: string;
  data: Record<string, unknown>;
}

export interface WsExecutionStartMessage {
  type: 'execution-start';
  executionId: string;
}

export interface WsOutputMessage {
  type: 'output';
  line: string;
  phase: string;
}

export interface WsCompleteMessage {
  type: 'complete';
  status: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dynamic Agent types (v0.5.0)
// ──────────────────────────────────────────────────────────────────────────────

export interface DynamicAgent {
  id: string;
  executionId: string;
  role: string;
  name: string;
  task: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output: string[];
  filesModified: string[];
  filesRead: string[];
  color: string;
  icon: string;
  spawnedAt: string;
  completedAt: string | null;
}

export interface FileActivityEvent {
  file: string;
  action: 'read' | 'write' | 'edit' | 'create' | 'delete';
  agentId: string;
  agentName: string;
  timestamp: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  lastActivity?: FileActivityEvent;
  isActive: boolean;
}

export interface Codebase {
  id: string;
  name: string;
  path: string;
  gitUrl: string | null;
  executionIds: string[];
  createdAt: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Dynamic Agent WebSocket message types (v0.5.0)
// ──────────────────────────────────────────────────────────────────────────────

export interface WsAgentSpawnMessage {
  type: 'agent-spawn';
  agent: DynamicAgent;
}

export interface WsAgentOutputMessage {
  type: 'agent-output';
  agentId: string;
  line: string;
}

export interface WsAgentCompleteMessage {
  type: 'agent-complete';
  agentId: string;
  status: 'completed' | 'failed';
  filesModified: string[];
}

export interface WsFileActivityMessage {
  type: 'file-activity';
  file: string;
  action: 'read' | 'write' | 'edit' | 'create' | 'delete';
  agentId: string;
  agentName: string;
}

export interface WsExecutionSnapshotMessage {
  type: 'execution-snapshot';
  execution: {
    id: string;
    status: string;
    pipeline: Array<{ phase: string; status: string }>;
  };
}

export type WsConsoleMessage =
  | WsConsoleTextMessage
  | WsClarificationMessage
  | WsAgentStatusMessage
  | WsAgentConnectionMessage
  | WsScreenshotMessage
  | WsBusinessEvalMessage
  | WsExecutionStartMessage
  | WsOutputMessage
  | WsCompleteMessage
  | WsAgentSpawnMessage
  | WsAgentOutputMessage
  | WsAgentCompleteMessage
  | WsFileActivityMessage
  | WsExecutionSnapshotMessage;
