import { Monitor, Loader, Coffee } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { StreamingOutput } from '../execution/StreamingOutput.tsx';
import type { Conversation, WsConsoleMessage } from '../../../lib/types.ts';

interface ContextPanelProps {
  conversation: Conversation | null;
  executionId: string | null;
  wsMessages: WsConsoleMessage[];
}

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

function ExecutionActiveView({ executionId, wsMessages }: { executionId: string; wsMessages: WsConsoleMessage[] }) {
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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-600">
        <Monitor className="h-4 w-4 text-accent-blue" />
        <span className="text-sm font-medium text-gray-200">Execution Progress</span>
        <span className="text-xs font-mono text-gray-500 ml-auto">{executionId.slice(0, 12)}</span>
      </div>

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
      <div className="flex-1 overflow-y-auto p-4">
        {outputLines.length > 0 ? (
          <StreamingOutput lines={outputLines} streaming className="max-h-full" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full">
            <Loader className="h-5 w-5 text-accent-blue animate-spin mb-2" />
            <p className="text-xs text-gray-500">Waiting for output...</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function ContextPanel({ conversation, executionId, wsMessages }: ContextPanelProps) {
  // Determine view based on state
  const hasExecution = executionId !== null;

  if (!conversation || !hasExecution) {
    return <IdleView />;
  }

  return <ExecutionActiveView executionId={executionId} wsMessages={wsMessages} />;
}
