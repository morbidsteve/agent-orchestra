import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrchestra } from '../context/OrchestraContext.tsx';
import { WORKFLOWS, MODELS } from '../lib/constants.ts';
import { Button } from '../components/ui/Button.tsx';
import { TextArea } from '../components/ui/TextArea.tsx';
import { Input } from '../components/ui/Input.tsx';
import { cn } from '../lib/cn.ts';
import type { WorkflowType } from '../lib/types.ts';
import { GitBranch, FileSearch, ShieldCheck, Lightbulb, Zap, Play, Clock, Cpu, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const workflowIcons: Record<string, LucideIcon> = {
  GitBranch,
  FileSearch,
  ShieldCheck,
  Lightbulb,
  Zap,
};

export function NewExecutionPage() {
  const navigate = useNavigate();
  const { startExecution } = useOrchestra();
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowType>('full-pipeline');
  const [task, setTask] = useState('');
  const [selectedModel, setSelectedModel] = useState('claude-opus-4-6');
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!task.trim() || loading) return;
    setLoading(true);
    try {
      const id = await startExecution(selectedWorkflow, task.trim(), selectedModel, target.trim());
      navigate(`/executions/${id}`);
    } catch {
      // Fallback: still allow interaction in mock mode
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">New Execution</h1>
        <p className="text-gray-400 mt-1">Configure and start a new workflow</p>
      </div>

      {/* Workflow Selector */}
      <div>
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Select Workflow</h2>
        <div className="grid grid-cols-3 gap-3">
          {WORKFLOWS.map((workflow) => {
            const Icon = workflowIcons[workflow.icon] || GitBranch;
            const isSelected = selectedWorkflow === workflow.type;

            return (
              <button
                key={workflow.type}
                onClick={() => setSelectedWorkflow(workflow.type)}
                className={cn(
                  'text-left rounded-xl border p-4 transition-colors',
                  isSelected
                    ? 'border-accent-blue bg-accent-blue/5'
                    : 'border-surface-600 bg-surface-800 hover:border-surface-500',
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-4 w-4', isSelected ? 'text-accent-blue' : 'text-gray-400')} />
                  <span className={cn('text-sm font-medium', isSelected ? 'text-accent-blue' : 'text-gray-200')}>
                    {workflow.name}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mb-2">{workflow.description}</p>
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {workflow.estimatedDuration}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Task Description */}
      <div>
        <TextArea
          id="task"
          label="Task Description"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          placeholder="Describe the task for the agents..."
          rows={4}
        />
      </div>

      {/* Model Picker */}
      <div>
        <h2 className="text-sm font-semibold text-gray-200 mb-3">Select Model</h2>
        <div className="grid grid-cols-3 gap-3">
          {MODELS.map((model) => {
            const isSelected = selectedModel === model.id;
            return (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={cn(
                  'text-left rounded-xl border p-4 transition-colors',
                  isSelected
                    ? 'border-accent-blue bg-accent-blue/5'
                    : 'border-surface-600 bg-surface-800 hover:border-surface-500',
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Cpu className={cn('h-4 w-4', isSelected ? 'text-accent-blue' : 'text-gray-400')} />
                  <span className={cn('text-sm font-medium', isSelected ? 'text-accent-blue' : 'text-gray-200')}>
                    {model.name}
                  </span>
                </div>
                <p className="text-xs text-gray-400">{model.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Target Input */}
      <div>
        <Input
          id="target"
          label="Target (optional)"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="e.g., src/auth/"
        />
      </div>

      {/* Start Button */}
      <div className="flex items-center gap-4">
        <Button
          size="lg"
          onClick={handleStart}
          disabled={!task.trim() || loading}
          className="gap-2"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {loading ? 'Starting...' : 'Start Execution'}
        </Button>
        <p className="text-xs text-gray-500">
          This will start a {WORKFLOWS.find(w => w.type === selectedWorkflow)?.name} workflow
        </p>
      </div>
    </div>
  );
}
