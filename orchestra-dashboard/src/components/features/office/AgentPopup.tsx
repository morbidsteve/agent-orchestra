import { useEffect, useRef } from 'react';
import type { AgentNode } from '../../../lib/types.ts';

interface AgentPopupProps {
  agent: AgentNode;
  output: string[];
  files: string[];
  onClose: () => void;
  position: { x: number; y: number }; // percentage coords of the clicked element
}

function extractFilename(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1] || filePath;
}

/** Status badge color and label */
function getStatusBadge(status: string): { color: string; bg: string; label: string } {
  switch (status) {
    case 'working':
      return { color: '#60a5fa', bg: 'rgba(59,130,246,0.15)', label: 'Working' };
    case 'done':
      return { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'Done' };
    case 'error':
      return { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'Error' };
    default:
      return { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'Idle' };
  }
}

export function AgentPopup({ agent, output, files, onClose, position }: AgentPopupProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    // Delay listener to avoid immediate close from the click that opened it
    const id = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 50);
    return () => {
      clearTimeout(id);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Auto-scroll output to bottom
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Positioning: prefer right side, fall back to left. Prefer below, fall back to above.
  const anchorRight = position.x <= 65;
  const anchorBelow = position.y <= 65;

  const popupStyle: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
    ...(anchorRight
      ? { left: `${position.x + 6}%` }
      : { right: `${100 - position.x + 6}%` }),
    ...(anchorBelow
      ? { top: `${position.y - 4}%` }
      : { bottom: `${100 - position.y + 4}%` }),
    maxWidth: '320px',
    minWidth: '260px',
    maxHeight: '400px',
    animation: 'popupFadeIn 0.15s ease-out',
  };

  const statusBadge = getStatusBadge(agent.visualStatus);
  const lastOutputLines = output.slice(-10);

  return (
    <div
      ref={popupRef}
      style={popupStyle}
      className="rounded-xl shadow-2xl overflow-hidden"
    >
      <div
        style={{
          backgroundColor: '#252830',
          border: '1px solid #3a3d45',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid #3a3d45' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* Agent color dot */}
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: agent.color }}
            />
            <span className="text-sm font-semibold text-gray-200 truncate">
              {agent.name}
            </span>
            {/* Role badge */}
            <span
              className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: '#9ca3af',
              }}
            >
              {agent.role.replace(/-/g, ' ')}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Status badge */}
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}
            >
              {statusBadge.label}
            </span>
            {/* Close button */}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              style={{
                fontSize: '16px',
                lineHeight: '1',
                padding: '2px 4px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
              aria-label="Close popup"
            >
              {'\u2715'}
            </button>
          </div>
        </div>

        {/* Current Task */}
        <div className="px-4 py-2" style={{ borderBottom: '1px solid #2a2d35' }}>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Current Task</div>
          <div className="text-xs text-gray-300">
            {agent.currentTask || 'Idle'}
          </div>
        </div>

        {/* Output */}
        {lastOutputLines.length > 0 && (
          <div className="px-4 py-2" style={{ borderBottom: '1px solid #2a2d35' }}>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Output</div>
            <div
              ref={outputRef}
              className="font-mono text-[10px] text-gray-400 overflow-y-auto"
              style={{
                maxHeight: '120px',
                lineHeight: '1.5',
                backgroundColor: '#1a1d23',
                borderRadius: '6px',
                padding: '6px 8px',
              }}
            >
              {lastOutputLines.map((line, i) => (
                <div key={i} className="truncate">{line || '\u00A0'}</div>
              ))}
            </div>
          </div>
        )}

        {/* Files */}
        {files.length > 0 && (
          <div className="px-4 py-2">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Files</div>
            <div className="flex flex-col gap-1">
              {files.slice(0, 8).map(file => (
                <div
                  key={file}
                  className="flex items-center gap-1.5 text-[10px] text-gray-400"
                  title={file}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
                    <rect x="1" y="0" width="8" height="10" rx="1" fill="rgba(156,163,175,0.2)" />
                    <line x1="3" y1="3" x2="7" y2="3" stroke="rgba(156,163,175,0.3)" strokeWidth="0.5" />
                    <line x1="3" y1="5" x2="7" y2="5" stroke="rgba(156,163,175,0.3)" strokeWidth="0.5" />
                    <line x1="3" y1="7" x2="6" y2="7" stroke="rgba(156,163,175,0.3)" strokeWidth="0.5" />
                  </svg>
                  <span className="truncate">{extractFilename(file)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes popupFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
