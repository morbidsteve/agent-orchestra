import { Building2 } from 'lucide-react';
import { useOfficeState } from '../hooks/useOfficeState.ts';
import { OfficeCanvas } from '../components/features/office/OfficeCanvas.tsx';
import { OfficeStatusBar } from '../components/features/office/OfficeStatusBar.tsx';
import { useExecutions } from '../hooks/useExecutions.ts';
import { useConsoleWebSocket } from '../hooks/useConsoleWebSocket.ts';
import { useConversationContext } from '../context/ConversationContext.tsx';
import { useDynamicAgents } from '../hooks/useDynamicAgents.ts';

export function AgentOfficePage() {
  const { latest } = useExecutions();
  const { conversation } = useConversationContext();

  // Show the most relevant execution: active if any, otherwise most recent
  const executionId = latest?.id ?? null;
  const startedAt = latest?.startedAt ?? null;

  const officeState = useOfficeState(executionId);

  // Get dynamic agent data from the current conversation's WebSocket
  const conversationId = conversation?.id ?? null;
  const { messages: wsMessages } = useConsoleWebSocket(conversationId);
  const { agents: dynamicAgents } = useDynamicAgents(wsMessages);

  // Build a lookup of dynamic agent output for the mini terminals
  const agentOutputMap = new Map<string, string[]>();
  const agentFilesMap = new Map<string, string[]>();
  for (const agent of dynamicAgents) {
    agentOutputMap.set(agent.id, agent.output);
    agentFilesMap.set(agent.id, [...agent.filesModified, ...agent.filesRead]);
  }

  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 3rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-gray-100">Agent Office</h1>
        </div>
        <OfficeStatusBar
          executionId={officeState.executionId}
          currentPhase={officeState.currentPhase}
          startedAt={startedAt}
        />
      </div>

      {/* Office Canvas fills the rest */}
      <div className="flex-1 min-h-0">
        <OfficeCanvas
          officeState={officeState}
          agentOutputMap={agentOutputMap}
          agentFilesMap={agentFilesMap}
        />
      </div>
    </div>
  );
}
