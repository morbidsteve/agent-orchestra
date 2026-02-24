import { useState } from 'react';
import { Monitor, Loader, Coffee, CheckCircle, XCircle, FolderTree, Users, BarChart3 } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { StreamingOutput } from '../execution/StreamingOutput.tsx';
import { FileTreePanel } from './FileTreePanel.tsx';
import type { Conversation, WsConsoleMessage, FileTreeNode, DynamicAgent } from '../../../lib/types.ts';
import type { ExecutionWsStatus } from '../../../hooks/useConsoleWebSocket.ts';

interface ContextPanelProps {
  conversation: Conversation | null;
  executionId: string | null;
  wsMessages: WsConsoleMessage[];
  executionStatus?: ExecutionWsStatus;
  fileTree?: FileTreeNode[];
  activeFiles?: string[];
  dynamicAgents?: DynamicAgent[];
}

type ContextTab = 'progress' | 'files' | 'agents';

function IdleView() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-6">
      <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-surface-700 mb-4">
        <Coffee className="h-7 w-7 text-gray-500" />
      </div>
      <h3 className="text-sm font-medium text-gray-300 mb-2">No active execution</h3>
      <div className="space-y-2 text-xs text-gray-500 max-w-xs">
        <p>Start a conversation to see execution progress, agent activity, and results here.</p>
        <div className="mt-4 space-y-1.5 text-left">
          <p className="text-gray-400 font-medium">Tips:</p>
          <p>&bull; Be specific about the task and target project</p>
          <p>&bull; Mention the workflow you want (review, fix, audit)</p>
          <p>&bull; The orchestra will ask for clarification if needed</p>
        </div>
      </div>
    </div>
  );
}

const AGENT_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-500',
  running: 'bg-blue-400 animate-pulse',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
};

function DynamicAgentsList({ agents }: { agents: DynamicAgent[] }) {
  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <Users className="h-6 w-6 text-gray-600 mb-2" />
        <p className="text-xs text-gray-500">No dynamic agents spawned yet</p>
        <p className="text-xs text-gray-600 mt-1">Agents will appear here as the orchestrator delegates work.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {agents.map(agent => (
        <div key={agent.id} className="rounded-lg border border-surface-600 bg-surface-800/50 p-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn('h-2 w-2 rounded-full shrink-0', AGENT_STATUS_COLORS[agent.status] || 'bg-gray-500')} />
            <span className="text-xs font-medium text-gray-200 truncate">{agent.name}</span>
            <span className="text-[10px] text-gray-500 ml-auto capitalize">{agent.status}</span>
          </div>
          <p className="text-[11px] text-gray-400 truncate">{agent.task}</p>
          {agent.filesModified.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {agent.filesModified.slice(0, 3).map(f => {
                const filename = f.split('/').pop() || f;
                return (
                  <span key={f} className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700 text-gray-400" title={f}>
                    {filename}
                  </span>
                );
              })}
              {agent.filesModified.length > 3 && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700 text-gray-500">
                  +{agent.filesModified.length - 3} more
                </span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ExecutionActiveView({
  executionId,
  wsMessages,
  executionStatus,
  fileTree = [],
  activeFiles = [],
  dynamicAgents = [],
}: {
  executionId: string;
  wsMessages: WsConsoleMessage[];
  executionStatus?: ExecutionWsStatus;
  fileTree?: FileTreeNode[];
  activeFiles?: string[];
  dynamicAgents?: DynamicAgent[];
}) {
  const [activeTab, setActiveTab] = useState<ContextTab>('progress');

  // Extract output lines from ws messages
  const outputLines = wsMessages
    .filter((m): m is Extract<WsConsoleMessage, { type: 'console-text' }> => m.type === 'console-text')
    .map(m => m.text);

  // Extract agent statuses
  const agentStatuses = wsMessages
    .filter((m): m is Extract<WsConsoleMessage, { type: 'agent-status' }> => m.type === 'agent-status');

  // Get latest status per agent
  const latestAgents = new Map<string, { visualStatus: string; currentTask: string }>();
  for (const msg of agentStatuses) {
    latestAgents.set(msg.agentRole, {
      visualStatus: msg.visualStatus,
      currentTask: msg.currentTask,
    });
  }

  const isCompleted = executionStatus === 'completed';
  const isFailed = executionStatus === 'failed';
  const isDone = isCompleted || isFailed;

  const tabs: { id: ContextTab; label: string; icon: typeof BarChart3; count?: number }[] = [
    { id: 'progress', label: 'Progress', icon: BarChart3 },
    { id: 'files', label: 'Files', icon: FolderTree, count: activeFiles.length || undefined },
    { id: 'agents', label: 'Agents', icon: Users, count: dynamicAgents.length || undefined },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-600">
        <Monitor className="h-4 w-4 text-accent-blue" />
        <span className="text-sm font-medium text-gray-200">Execution Progress</span>
        {isCompleted && <CheckCircle className="h-4 w-4 text-green-400 ml-auto" />}
        {isFailed && <XCircle className="h-4 w-4 text-red-400 ml-auto" />}
        <span className={cn(
          'text-xs font-mono text-gray-500',
          !isDone && 'ml-auto',
        )}>{executionId.slice(0, 12)}</span>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-surface-600 bg-surface-800/50">
        {tabs.map(tab => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-surface-700 text-gray-200'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700/50',
              )}
            >
              <TabIcon className="h-3 w-3" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0 rounded-full',
                  activeTab === tab.id ? 'bg-accent-blue/20 text-accent-blue' : 'bg-surface-600 text-gray-400',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'progress' && (
          <>
            {/* Agent status */}
            {latestAgents.size > 0 && (
              <div className="px-4 py-3 border-b border-surface-600 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Agents</p>
                {Array.from(latestAgents.entries()).map(([role, status]) => (
                  <div key={role} className="flex items-center gap-2">
                    <div className={cn(
                      'h-2 w-2 rounded-full',
                      status.visualStatus === 'working' && 'bg-accent-blue animate-pulse',
                      status.visualStatus === 'done' && 'bg-green-400',
                      status.visualStatus === 'error' && 'bg-red-400',
                      status.visualStatus === 'idle' && 'bg-gray-500',
                    )} />
                    <span className="text-xs text-gray-300 font-medium">{role}</span>
                    {status.currentTask && (
                      <span className="text-xs text-gray-500 truncate ml-auto">{status.currentTask}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Streaming output */}
            <div className="p-4">
              {outputLines.length > 0 ? (
                <StreamingOutput lines={outputLines} streaming={!isDone} className="max-h-full" />
              ) : isDone ? (
                <div className="flex flex-col items-center justify-center py-12">
                  {isCompleted ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
                      <p className="text-xs text-gray-400">Execution completed</p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-red-400 mb-2" />
                      <p className="text-xs text-red-400">Execution failed</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader className="h-5 w-5 text-accent-blue animate-spin mb-2" />
                  <p className="text-xs text-gray-500">Waiting for output...</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'files' && (
          <FileTreePanel tree={fileTree} activeFiles={activeFiles} />
        )}

        {activeTab === 'agents' && (
          <DynamicAgentsList agents={dynamicAgents} />
        )}
      </div>
    </div>
  );
}

export function ContextPanel({
  conversation,
  executionId,
  wsMessages,
  executionStatus,
  fileTree,
  activeFiles,
  dynamicAgents,
}: ContextPanelProps) {
  // Determine view based on state
  const hasExecution = executionId !== null;

  if (!conversation || !hasExecution) {
    return <IdleView />;
  }

  return (
    <ExecutionActiveView
      executionId={executionId}
      wsMessages={wsMessages}
      executionStatus={executionStatus}
      fileTree={fileTree}
      activeFiles={activeFiles}
      dynamicAgents={dynamicAgents}
    />
  );
}
