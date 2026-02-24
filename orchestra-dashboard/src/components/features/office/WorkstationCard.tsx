import { Coffee, FlaskConical, Lock, BarChart3, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { AgentNode } from '../../../lib/types.ts';

interface WorkstationCardProps {
  agent: AgentNode;
  position: { x: number; y: number };
  outputLines?: string[];
  filesWorking?: string[];
}

function extractFilename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

/** Tiny desk accessory icon based on agent role */
function DeskAccessory({ role }: { role: string }) {
  const iconClass = 'h-2.5 w-2.5 opacity-40';
  if (role === 'developer' || role === 'developer-2') return <Coffee className={iconClass} style={{ color: '#a0845c' }} />;
  if (role === 'tester') return <FlaskConical className={iconClass} style={{ color: '#22c55e' }} />;
  if (role === 'devsecops') return <Lock className={iconClass} style={{ color: '#f97316' }} />;
  if (role === 'business-dev') return <BarChart3 className={iconClass} style={{ color: '#a855f7' }} />;
  return null;
}

export function DeskWorkstation({ agent, position, outputLines = [], filesWorking = [] }: WorkstationCardProps) {
  const isWorking = agent.visualStatus === 'working';
  const isDone = agent.visualStatus === 'done';
  const isError = agent.visualStatus === 'error';
  const isIdle = agent.visualStatus === 'idle';

  const lastLines = outputLines.slice(-3);
  const displayFiles = filesWorking.slice(0, 3);

  // Monitor glow color
  const monitorGlow = isWorking
    ? agent.color
    : isDone
      ? '#22c55e'
      : isError
        ? '#ef4444'
        : 'transparent';

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Desk surface */}
      <div
        className={cn(
          'relative w-48 rounded-lg transition-all duration-300',
          isIdle && 'opacity-70',
        )}
        style={{
          backgroundColor: '#252830',
          border: '1px solid #333842',
          boxShadow: isWorking
            ? `0 0 16px ${agent.color}22, 0 2px 8px rgba(0,0,0,0.4)`
            : '0 2px 8px rgba(0,0,0,0.3)',
        }}
      >
        {/* Monitor */}
        <div
          className="mx-2 mt-2 rounded overflow-hidden"
          style={{
            backgroundColor: '#0d1117',
            borderTop: `2px solid ${monitorGlow}`,
            boxShadow: isWorking
              ? `0 0 8px ${agent.color}33, inset 0 1px 4px ${agent.color}11`
              : isDone
                ? '0 0 6px rgba(34,197,94,0.15)'
                : isError
                  ? '0 0 6px rgba(239,68,68,0.15)'
                  : 'none',
            minHeight: '36px',
          }}
        >
          {/* Screen content */}
          {lastLines.length > 0 ? (
            <pre className="text-[9px] font-mono leading-tight text-gray-500 p-1.5 overflow-hidden">
              {lastLines.map((line, i) => (
                <div key={i} className="truncate">{line || '\u00A0'}</div>
              ))}
              {isWorking && (
                <span className="inline-block w-1.5 h-2.5 bg-gray-500 animate-pulse" />
              )}
            </pre>
          ) : (
            <div className="flex items-center justify-center h-9">
              {isDone && <CheckCircle className="h-4 w-4 text-green-500/60" />}
              {isError && <XCircle className="h-4 w-4 text-red-500/60" />}
              {isIdle && <span className="text-[9px] text-gray-600">standby</span>}
              {isWorking && (
                <span className="inline-block w-1.5 h-2.5 bg-gray-500 animate-pulse" />
              )}
            </div>
          )}
        </div>

        {/* Agent identity row */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5">
          {/* Avatar dot */}
          <span
            className={cn('h-2.5 w-2.5 rounded-full shrink-0', isWorking && 'animate-pulse')}
            style={{ backgroundColor: agent.color, opacity: isIdle ? 0.5 : 1 }}
          />
          <span className="text-[11px] font-medium text-gray-300 truncate flex-1">{agent.name}</span>
          <DeskAccessory role={agent.role} />
          {/* Status dot */}
          {isDone && <span className="h-2 w-2 rounded-full bg-green-400 shrink-0" />}
          {isError && <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />}
          {isWorking && (
            <span
              className="h-2 w-2 rounded-full animate-pulse shrink-0"
              style={{ backgroundColor: agent.color }}
            />
          )}
        </div>

        {/* File badges */}
        {displayFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 px-2 pb-1">
            {displayFiles.map(file => (
              <span
                key={file}
                className="text-[9px] px-1.5 py-0.5 rounded bg-surface-700/60 text-gray-400 truncate max-w-[70px]"
                title={file}
              >
                {extractFilename(file)}
              </span>
            ))}
          </div>
        )}

        {/* Bottom role bar */}
        <div className="flex items-center justify-between px-2.5 py-1 border-t border-[#333842]/50">
          <span className="text-[9px] text-gray-500 capitalize">{agent.role.replace(/-/g, ' ')}</span>
          {agent.currentTask && (
            <span className="text-[9px] text-gray-500 truncate ml-2 max-w-[80px]" title={agent.currentTask}>
              {agent.currentTask}
            </span>
          )}
        </div>
      </div>

      {/* Chair (semi-circle below desk) */}
      <div className="flex justify-center mt-0.5">
        <div
          className={cn(
            'w-8 h-3.5 rounded-b-full transition-all duration-300',
            isWorking ? 'opacity-60' : 'opacity-30',
          )}
          style={{
            backgroundColor: agent.color,
          }}
        />
      </div>
    </div>
  );
}
