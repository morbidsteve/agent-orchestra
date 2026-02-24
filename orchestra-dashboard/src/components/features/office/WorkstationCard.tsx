import { Code2, TestTube2, Shield, FileText, TrendingUp, Bot, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { AgentNode } from '../../../lib/types.ts';

interface WorkstationCardProps {
  agent: AgentNode;
  position: { x: number; y: number };
  outputLines?: string[];
  filesWorking?: string[];
}

function AgentIcon({ iconName, className, color }: { iconName: string; className?: string; color?: string }) {
  const style = color ? { color } : undefined;
  switch (iconName) {
    case 'Code2':
    case 'Terminal':
    case 'Code':
      return <Code2 className={className} style={style} />;
    case 'TestTube2':
    case 'FlaskConical':
      return <TestTube2 className={className} style={style} />;
    case 'Shield':
      return <Shield className={className} style={style} />;
    case 'FileText':
      return <FileText className={className} style={style} />;
    case 'TrendingUp':
    case 'Briefcase':
      return <TrendingUp className={className} style={style} />;
    default:
      return <Bot className={className} style={style} />;
  }
}

function extractFilename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

export function WorkstationCard({ agent, position, outputLines = [], filesWorking = [] }: WorkstationCardProps) {
  const isWorking = agent.visualStatus === 'working';
  const isDone = agent.visualStatus === 'done';
  const isError = agent.visualStatus === 'error';
  const isIdle = agent.visualStatus === 'idle';

  const lastLines = outputLines.slice(-3);
  const displayFiles = filesWorking.slice(0, 3);

  return (
    <div
      className={cn(
        'absolute w-44 rounded-lg border bg-surface-800 shadow-lg transition-all duration-300',
        isWorking && 'border-opacity-80',
        isDone && 'border-green-500/40',
        isError && 'border-red-500/40',
        isIdle && 'border-surface-600 opacity-80',
        !isIdle && !isDone && !isError && 'border-surface-500',
      )}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        borderColor: isWorking ? agent.color : undefined,
        boxShadow: isWorking ? `0 0 12px ${agent.color}33, 0 0 24px ${agent.color}11` : undefined,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-surface-600/50">
        <AgentIcon iconName={agent.icon} className="h-3.5 w-3.5 shrink-0" color={agent.color} />
        <span className="text-xs font-medium text-gray-200 truncate flex-1">{agent.name}</span>
        {isDone && <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />}
        {isError && <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
        {isWorking && (
          <span
            className="h-2 w-2 rounded-full animate-pulse shrink-0"
            style={{ backgroundColor: agent.color }}
          />
        )}
        {isIdle && (
          <span className="h-2 w-2 rounded-full bg-gray-500 shrink-0" />
        )}
      </div>

      {/* Mini terminal */}
      {lastLines.length > 0 && (
        <div className="px-2 py-1.5 bg-surface-900/60 mx-1 mt-1 rounded">
          <pre className="text-[9px] font-mono leading-tight text-gray-500 overflow-hidden">
            {lastLines.map((line, i) => (
              <div key={i} className="truncate">{line || '\u00A0'}</div>
            ))}
            {isWorking && (
              <span className="inline-block w-1.5 h-2.5 bg-gray-500 animate-pulse" />
            )}
          </pre>
        </div>
      )}

      {/* File badges */}
      {displayFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-2 py-1">
          {displayFiles.map(file => (
            <span
              key={file}
              className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700 text-gray-400 truncate max-w-[70px]"
              title={file}
            >
              {extractFilename(file)}
            </span>
          ))}
        </div>
      )}

      {/* Bottom status bar */}
      <div className="flex items-center justify-between px-2.5 py-1 border-t border-surface-600/50">
        <span className="text-[9px] text-gray-500 capitalize">{agent.role.replace(/-/g, ' ')}</span>
        {agent.currentTask && (
          <span className="text-[9px] text-gray-500 truncate ml-2 max-w-[80px]" title={agent.currentTask}>
            {agent.currentTask}
          </span>
        )}
      </div>
    </div>
  );
}
