import type { AgentInfo, Workflow } from './types';

export const AGENTS: AgentInfo[] = [
  {
    role: 'developer',
    name: 'Developer (Primary)',
    description: 'Senior software engineer handling architecture decisions, complex implementations, and code quality.',
    status: 'busy',
    capabilities: ['Architecture', 'Implementation', 'Refactoring', 'Code Review'],
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    color: '#3b82f6',
    icon: 'Terminal',
    currentExecution: 'exec-001',
    completedTasks: 47,
    successRate: 96,
  },
  {
    role: 'developer-2',
    name: 'Developer (Secondary)',
    description: 'Software engineer handling independent modules and parallel features without conflicts.',
    status: 'idle',
    capabilities: ['Utilities', 'Independent Services', 'Parallel Features'],
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'],
    color: '#06b6d4',
    icon: 'Code',
    currentExecution: null,
    completedTasks: 23,
    successRate: 94,
  },
  {
    role: 'tester',
    name: 'Tester',
    description: 'QA engineer writing comprehensive tests, running test suites, and performing coverage analysis.',
    status: 'busy',
    capabilities: ['Unit Tests', 'Integration Tests', 'Coverage Analysis', 'Regression Checks'],
    tools: ['Read', 'Bash', 'Grep', 'Glob'],
    color: '#22c55e',
    icon: 'FlaskConical',
    currentExecution: 'exec-001',
    completedTasks: 38,
    successRate: 100,
  },
  {
    role: 'devsecops',
    name: 'DevSecOps',
    description: 'Security engineer finding vulnerabilities, exposed secrets, and compliance gaps.',
    status: 'idle',
    capabilities: ['Secret Scanning', 'Dependency Audit', 'Code Security', 'Infrastructure Review'],
    tools: ['Read', 'Bash', 'Grep', 'Glob'],
    color: '#f97316',
    icon: 'Shield',
    currentExecution: null,
    completedTasks: 31,
    successRate: 98,
  },
  {
    role: 'business-dev',
    name: 'Business Dev',
    description: 'Business development and product strategy expert for market analysis and feature prioritization.',
    status: 'offline',
    capabilities: ['Market Analysis', 'Competitive Research', 'Feature Prioritization', 'GTM Strategy'],
    tools: ['WebSearch', 'WebFetch', 'Read'],
    color: '#a855f7',
    icon: 'Briefcase',
    currentExecution: null,
    completedTasks: 12,
    successRate: 92,
  },
];

export const WORKFLOWS: Workflow[] = [
  {
    type: 'full-pipeline',
    name: 'Full Pipeline',
    description: 'Parallel pipeline: Plan \u2192 [Develop + Develop\u2082] \u2192 [Test + Security] \u2192 Report',
    phases: ['plan', 'develop', 'test', 'security', 'report'],
    icon: 'GitBranch',
    estimatedDuration: '15-30 min',
  },
  {
    type: 'code-review',
    name: 'Code Review',
    description: 'Parallel review: [Develop + Test + Security] \u2192 Report',
    phases: ['plan', 'develop', 'test', 'security', 'report'],
    icon: 'FileSearch',
    estimatedDuration: '5-10 min',
  },
  {
    type: 'security-audit',
    name: 'Security Audit',
    description: 'Comprehensive security review with remediation steps',
    phases: ['plan', 'security', 'report'],
    icon: 'ShieldCheck',
    estimatedDuration: '10-15 min',
  },
  {
    type: 'feature-eval',
    name: 'Feature Evaluation',
    description: 'Parallel eval: Plan \u2192 [Develop + Biz Eval] \u2192 Report',
    phases: ['plan', 'develop', 'report'],
    icon: 'Lightbulb',
    estimatedDuration: '10-20 min',
  },
  {
    type: 'quick-fix',
    name: 'Quick Fix',
    description: 'Quick fix: Develop \u2192 [Test + Security] \u2192 Report',
    phases: ['develop', 'test', 'report'],
    icon: 'Zap',
    estimatedDuration: '5-10 min',
  },
];

export const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
  high: { label: 'High', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  medium: { label: 'Medium', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  low: { label: 'Low', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  info: { label: 'Info', color: 'text-gray-400', bg: 'bg-gray-500/10 border-gray-500/20' },
};

export const PHASE_LABELS: Record<string, string> = {
  plan: 'Plan',
  develop: 'Develop',
  'develop-2': 'Develop (2)',
  test: 'Test',
  security: 'Security',
  'business-eval': 'Biz Eval',
  report: 'Report',
};

export const STATUS_LABELS: Record<string, string> = {
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  queued: 'Queued',
  pending: 'Pending',
  skipped: 'Skipped',
};

export const MODELS = [
  { id: 'opus', name: 'Claude Opus 4.6', description: 'Most capable, best for complex tasks' },
  { id: 'sonnet', name: 'Claude Sonnet 4.5', description: 'Balanced performance and speed' },
  { id: 'haiku', name: 'Claude Haiku 4.5', description: 'Fastest, good for simple tasks' },
];
