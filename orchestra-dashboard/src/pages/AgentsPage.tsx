import { useOrchestra } from '../context/OrchestraContext.tsx';
import { AgentCard } from '../components/features/agents/index.ts';

export function AgentsPage() {
  const { agents } = useOrchestra();

  const online = agents.filter(a => a.status !== 'offline');
  const offline = agents.filter(a => a.status === 'offline');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Agents</h1>
        <p className="text-gray-400 mt-1">
          {online.length} online, {offline.length} offline
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.role} agent={agent} />
        ))}
      </div>
    </div>
  );
}
