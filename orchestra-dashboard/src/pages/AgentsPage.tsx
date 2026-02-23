import { useState } from 'react';
import { useOrchestra } from '../context/OrchestraContext.tsx';
import { AgentCard, CreateAgentModal } from '../components/features/agents/index.ts';
import { Plus } from 'lucide-react';

export function AgentsPage() {
  const { agents, createAgent, deleteAgent } = useOrchestra();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const online = agents.filter(a => a.status !== 'offline');
  const offline = agents.filter(a => a.status === 'offline');

  const handleCreate = async (data: {
    name: string;
    description: string;
    capabilities: string[];
    tools: string[];
    color: string;
    icon: string;
  }) => {
    await createAgent(data);
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Agents</h1>
          <p className="text-gray-400 mt-1">
            {online.length} online, {offline.length} offline
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Create Agent
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent) => (
          <AgentCard
            key={agent.role}
            agent={agent}
            onDelete={agent.isCustom ? () => deleteAgent(agent.role) : undefined}
          />
        ))}
      </div>

      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
