import { useMemo } from 'react';
import { Activity, CheckCircle, XCircle, Layers } from 'lucide-react';
import { useExecutions } from '../hooks/useExecutions.ts';
import { useAgents } from '../hooks/useAgents.ts';
import { useLiveDashboardAgents } from '../hooks/useLiveDashboardAgents.ts';
import { StatsCard, ActiveExecutions, RecentResults, AgentStatusGrid } from '../components/features/dashboard/index.ts';

interface DashboardPageProps {
  conversationId?: string | null;
}

export function DashboardPage({ conversationId }: DashboardPageProps) {
  const { active, completed, stats } = useExecutions(conversationId);
  const { agents, busyCount } = useAgents();

  const activeIds = useMemo(() => active.map((e) => e.id), [active]);
  const { agentsByExecution, allAgents } = useLiveDashboardAgents(activeIds);
  const dynamicBusyCount = allAgents.filter((a) => a.status === 'running').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Dashboard</h1>
        <p className="text-gray-400 mt-1">System overview and active executions</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <StatsCard
          icon={Layers}
          label="Total Executions"
          value={stats.total}
          subtitle={`${stats.queued} queued`}
          iconColor="text-accent-blue"
          iconBg="bg-accent-blue/10"
        />
        <StatsCard
          icon={Activity}
          label="Running"
          value={stats.running}
          subtitle={`${dynamicBusyCount > 0 ? dynamicBusyCount : busyCount} agents busy`}
          iconColor="text-green-400"
          iconBg="bg-green-500/10"
        />
        <StatsCard
          icon={CheckCircle}
          label="Completed"
          value={stats.completed}
          iconColor="text-emerald-400"
          iconBg="bg-emerald-500/10"
        />
        <StatsCard
          icon={XCircle}
          label="Failed"
          value={stats.failed}
          subtitle="1 critical finding"
          iconColor="text-red-400"
          iconBg="bg-red-500/10"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-6">
        <ActiveExecutions executions={active} agentsByExecution={agentsByExecution} />
        <RecentResults executions={completed} />
      </div>

      {/* Agent Status */}
      <AgentStatusGrid agents={agents} dynamicAgents={allAgents} />
    </div>
  );
}
