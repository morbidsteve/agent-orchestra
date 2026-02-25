import { Landmark } from 'lucide-react';
import { OfficeCanvas } from '../components/features/office/OfficeCanvas.tsx';
import { OfficeStatusBar } from '../components/features/office/OfficeStatusBar.tsx';
import type { OfficeState } from '../lib/types.ts';

interface AgentOfficePageProps {
  officeState: OfficeState;
  startedAt: string | null;
  agentOutputMap: Map<string, string[]>;
  agentFilesMap: Map<string, string[]>;
}

export function AgentOfficePage({ officeState, startedAt, agentOutputMap, agentFilesMap }: AgentOfficePageProps) {
  return (
    <div className="flex flex-col gap-4" style={{ height: 'calc(100vh - 5.5rem)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-amber-400/80" />
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
