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

/** Role-specific desk decoration SVG items */
function DeskDecoration({ role, color }: { role: string; color: string }) {
  if (role === 'developer' || role === 'developer-2') {
    return (
      <svg width="20" height="14" viewBox="0 0 20 14" className="opacity-30">
        {/* Code brackets */}
        <text x="2" y="11" fontSize="10" fill={color} fontFamily="monospace">{'</>'}</text>
      </svg>
    );
  }
  if (role === 'tester') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" className="opacity-30">
        {/* Test tube */}
        <rect x="6" y="2" width="4" height="10" rx="1" fill={color} opacity="0.5" />
        <circle cx="8" cy="13" r="3" fill={color} opacity="0.3" />
      </svg>
    );
  }
  if (role === 'devsecops') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" className="opacity-30">
        {/* Shield */}
        <path d="M8 1 L14 4 L14 9 C14 12 8 15 8 15 C8 15 2 12 2 9 L2 4 Z" fill={color} opacity="0.4" />
      </svg>
    );
  }
  if (role === 'business-dev') {
    return (
      <svg width="20" height="14" viewBox="0 0 20 14" className="opacity-30">
        {/* Bar chart */}
        <rect x="2" y="8" width="3" height="6" fill={color} opacity="0.3" />
        <rect x="7" y="4" width="3" height="10" fill={color} opacity="0.4" />
        <rect x="12" y="1" width="3" height="13" fill={color} opacity="0.5" />
      </svg>
    );
  }
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
      {/* Spacer above desk (character walks here separately) */}
      <div className="h-2" />

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

        {/* Monitor stand */}
        <div className="flex justify-center">
          <div style={{
            width: '12px',
            height: '4px',
            backgroundColor: '#333842',
            borderRadius: '0 0 2px 2px',
          }} />
        </div>
        <div className="flex justify-center">
          <div style={{
            width: '24px',
            height: '2px',
            backgroundColor: '#333842',
            borderRadius: '1px',
          }} />
        </div>

        {/* Keyboard */}
        <div className="flex justify-center my-1">
          <div style={{
            width: '40px',
            height: '6px',
            backgroundColor: '#2a2d35',
            borderRadius: '1px',
            border: '1px solid #333842',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1px',
            paddingTop: '1px',
          }}>
            {[0,1,2,3,4].map(i => (
              <span key={i} style={{ display: 'inline-block', width: '3px', height: '2px', backgroundColor: '#3a3d45', borderRadius: '0.5px' }} />
            ))}
          </div>
        </div>

        {/* Role-specific desk decoration */}
        <div className="flex items-center justify-center mb-0.5">
          <DeskDecoration role={agent.role} color={agent.color} />
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

      {/* Office chair */}
      <div className="flex justify-center mt-1">
        <svg width="36" height="16" viewBox="0 0 36 16" fill="none">
          {/* Seat cushion */}
          <rect x="4" y="0" width="28" height="6" rx="3" fill={agent.color} opacity={isWorking ? 0.3 : 0.12} />
          {/* Chair base/stem */}
          <rect x="15" y="6" width="6" height="4" rx="1" fill={agent.color} opacity={isWorking ? 0.2 : 0.08} />
          {/* Wheels */}
          <circle cx="10" cy="14" r="2" fill={agent.color} opacity={isWorking ? 0.2 : 0.08} />
          <circle cx="18" cy="14" r="2" fill={agent.color} opacity={isWorking ? 0.2 : 0.08} />
          <circle cx="26" cy="14" r="2" fill={agent.color} opacity={isWorking ? 0.2 : 0.08} />
        </svg>
      </div>
    </div>
  );
}
