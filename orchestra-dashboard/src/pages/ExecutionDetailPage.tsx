import { useParams, Link } from 'react-router-dom';
import { useOrchestra } from '../context/OrchestraContext.tsx';
import {
  ExecutionHeader,
  PipelineTimeline,
  AgentActivityCard,
  DynamicAgentCard,
  StreamingOutput,
} from '../components/features/execution/index.ts';
import { ClarificationCard } from '../components/features/console/ClarificationCard.tsx';
import { useWebSocket } from '../hooks/useWebSocket.ts';
import { useDynamicAgents } from '../hooks/useDynamicAgents.ts';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';
import type { WsConsoleMessage } from '../lib/types.ts';

export function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { executions } = useOrchestra();
  const execution = executions.find(e => e.id === id);

  // Subscribe to WebSocket for live updates on running executions
  const isRunning = execution?.status === 'running' || execution?.status === 'queued';
  const { lines: liveLines, messages, connected, pendingQuestion, sendAnswer } = useWebSocket(id ?? null);
  const { agents: dynamicAgents } = useDynamicAgents(messages as WsConsoleMessage[]);

  if (!execution) {
    return (
      <div className="text-center py-12">
        <h1 className="text-xl font-bold text-gray-200">Execution not found</h1>
        <p className="text-gray-400 mt-2">The execution &quot;{id}&quot; does not exist.</p>
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-accent-blue hover:underline mt-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const hasDynamicAgents = dynamicAgents.length > 0;

  return (
    <div className="space-y-6">
      <ExecutionHeader execution={execution} />

      {/* Legacy pipeline timeline -- only when no dynamic agents */}
      {!hasDynamicAgents && <PipelineTimeline steps={execution.pipeline} />}

      {/* Dynamic per-agent cards */}
      {hasDynamicAgents && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-200">Live Agents</h2>
            <span className="text-xs text-gray-500">
              {dynamicAgents.filter(a => a.status === 'running').length} running
              {' / '}
              {dynamicAgents.length} total
            </span>
            {connected && (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="h-3 w-3" />
                Connected
              </div>
            )}
          </div>
          <div className="space-y-4">
            {dynamicAgents.map(agent => (
              <DynamicAgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </div>
      )}

      {/* Orchestrator live output */}
      {liveLines.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-200">
              {hasDynamicAgents ? 'Orchestrator Output' : 'Live Output'}
            </h2>
            {!hasDynamicAgents && connected ? (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="h-3 w-3" />
                Connected
              </div>
            ) : !hasDynamicAgents && isRunning ? (
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <WifiOff className="h-3 w-3" />
                Disconnected
              </div>
            ) : null}
          </div>
          <StreamingOutput lines={liveLines} streaming={isRunning && connected} />
          {pendingQuestion && (
            <div className="mt-3">
              <ClarificationCard
                question={pendingQuestion.question}
                options={pendingQuestion.options}
                required={pendingQuestion.required}
                onReply={(answer) => sendAnswer(pendingQuestion.questionId, answer)}
              />
            </div>
          )}
        </div>
      )}

      {/* Legacy agent activity (post-hoc) -- only when no dynamic agents */}
      {!hasDynamicAgents && execution.activities.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Agent Activity</h2>
          <div className="space-y-4">
            {execution.activities.map((activity) => (
              <AgentActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
