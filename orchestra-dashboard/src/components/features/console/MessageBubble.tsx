import { cn } from '../../../lib/cn.ts';
import { Loader } from 'lucide-react';
import type { ConversationMessage } from '../../../lib/types.ts';
import { ClarificationCard } from './ClarificationCard.tsx';
import { ProgressInlineCard } from './ProgressInlineCard.tsx';

interface MessageBubbleProps {
  message: ConversationMessage;
  onClarificationReply?: (answer: string) => void;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatText(text: string): React.ReactNode {
  // Simple markdown-like formatting: bold, inline code, code blocks
  const parts: React.ReactNode[] = [];
  const lines = text.split('\n');
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];
  let keyIdx = 0;

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        // Close code block
        parts.push(
          <pre key={keyIdx++} className="bg-surface-900 rounded-md p-2 my-1 text-xs font-mono text-gray-300 overflow-x-auto">
            {codeBlockLines.join('\n')}
          </pre>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Process inline formatting
    const formatted = line
      .split(/(\*\*[^*]+\*\*|`[^`]+`)/)
      .map((segment, i) => {
        if (segment.startsWith('**') && segment.endsWith('**')) {
          return <strong key={i} className="font-semibold text-gray-100">{segment.slice(2, -2)}</strong>;
        }
        if (segment.startsWith('`') && segment.endsWith('`')) {
          return <code key={i} className="bg-surface-900 px-1 py-0.5 rounded text-xs font-mono text-accent-blue">{segment.slice(1, -1)}</code>;
        }
        return segment;
      });

    parts.push(<div key={keyIdx++}>{formatted}</div>);
  }

  // Handle unclosed code block
  if (inCodeBlock && codeBlockLines.length > 0) {
    parts.push(
      <pre key={keyIdx++} className="bg-surface-900 rounded-md p-2 my-1 text-xs font-mono text-gray-300 overflow-x-auto">
        {codeBlockLines.join('\n')}
      </pre>
    );
  }

  return <>{parts}</>;
}

export function MessageBubble({ message, onClarificationReply }: MessageBubbleProps) {
  const { role, contentType, text, timestamp, clarification, executionRef } = message;

  // System messages
  if (role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <div className="bg-surface-800 border border-surface-600 rounded-lg px-4 py-2 max-w-md">
          <p className="text-xs text-gray-500 italic text-center">{text}</p>
          <p className="text-xs text-gray-600 text-center mt-1">{formatTime(timestamp)}</p>
        </div>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div className={cn('flex my-2', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-[80%] px-4 py-2.5',
        isUser
          ? 'bg-accent-blue/20 border border-accent-blue/20 rounded-2xl rounded-br-sm'
          : 'bg-surface-700 border border-surface-600 rounded-2xl rounded-bl-sm',
      )}>
        {/* Clarification content */}
        {contentType === 'clarification' && clarification && onClarificationReply ? (
          <ClarificationCard
            question={clarification.question}
            options={clarification.options}
            required={clarification.required}
            onReply={onClarificationReply}
          />
        ) : contentType === 'execution-start' && executionRef ? (
          <ProgressInlineCard executionId={executionRef} />
        ) : contentType === 'progress' ? (
          <div className="flex items-center gap-2">
            <Loader className="h-3.5 w-3.5 text-accent-blue animate-spin" />
            <span className="text-sm text-gray-300">{text}</span>
          </div>
        ) : (
          <div className={cn('text-sm', isUser ? 'text-gray-100' : 'text-gray-300')}>
            {formatText(text)}
          </div>
        )}

        {/* Timestamp */}
        <p className={cn(
          'text-xs mt-1',
          isUser ? 'text-accent-blue/60 text-right' : 'text-gray-500',
        )}>
          {formatTime(timestamp)}
        </p>
      </div>
    </div>
  );
}
