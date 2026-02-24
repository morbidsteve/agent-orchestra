import { useParams, Link } from 'react-router-dom';
import { useOrchestra } from '../context/OrchestraContext.tsx';
import {
  ExecutionHeader,
  PipelineTimeline,
  AgentActivityCard,
  StreamingOutput,
} from '../components/features/execution/index.ts';
import { ClarificationCard } from '../components/features/console/ClarificationCard.tsx';
import { useWebSocket } from '../hooks/useWebSocket.ts';
import { ArrowLeft, Wifi, WifiOff } from 'lucide-react';

export function ExecutionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { executions } = useOrchestra();
  const execution = executions.find(e => e.id === id);

  // Subscribe to WebSocket for live updates on running executions
  const isRunning = execution?.status === 'running' || execution?.status === 'queued';
  const { lines: liveLines, connected, pendingQuestion, sendAnswer } = useWebSocket(isRunning ? id ?? null : null);

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

  return (
    <div className="space-y-6">
      <ExecutionHeader execution={execution} />
      <PipelineTimeline steps={execution.pipeline} />

      {liveLines.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-lg font-semibold text-gray-200">Live Output</h2>
            {connected ? (
              <div className="flex items-center gap-1 text-xs text-green-400">
                <Wifi className="h-3 w-3" />
                Connected
              </div>
            ) : isRunning ? (
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

      {execution.activities.length > 0 && (
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
