import { useState } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface ClarificationCardProps {
  question: string;
  options?: string[];
  required: boolean;
  onReply: (answer: string) => void;
}

export function ClarificationCard({ question, options, required, onReply }: ClarificationCardProps) {
  const [textInput, setTextInput] = useState('');
  const [replied, setReplied] = useState(false);

  function handleReply(answer: string) {
    if (replied) return;
    setReplied(true);
    onReply(answer);
  }

  function handleSubmitText() {
    const trimmed = textInput.trim();
    if (!trimmed) return;
    handleReply(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmitText();
    }
  }

  return (
    <div className={cn(
      'rounded-lg bg-surface-700 border border-surface-600 p-4 space-y-3',
      replied && 'opacity-60',
    )}>
      <p className="text-sm text-gray-200 font-medium">{question}</p>

      {required && (
        <p className="text-xs text-amber-400">Response required</p>
      )}

      {options && options.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              disabled={replied}
              onClick={() => handleReply(option)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                'bg-accent-blue/20 text-accent-blue border border-accent-blue/30',
                'hover:bg-accent-blue/30',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      )}

      {!replied && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Or type your answer..."
            className="flex-1 bg-surface-800 border border-surface-600 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-blue"
          />
          <button
            type="button"
            onClick={handleSubmitText}
            disabled={!textInput.trim()}
            className="p-1.5 rounded-lg text-accent-blue hover:bg-accent-blue/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
