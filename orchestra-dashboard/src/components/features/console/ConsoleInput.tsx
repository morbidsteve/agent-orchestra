import { useState, useRef, useCallback, useEffect } from 'react';
import { Send } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface ConsoleInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ConsoleInput({ onSend, disabled }: ConsoleInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    autoResize();
  }, [text, autoResize]);

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    // Reset textarea height after send
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="border-t border-surface-600 bg-surface-800 p-3">
      {/* Input row */}
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you want to build..."
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-surface-900 border border-surface-600 rounded-lg px-3 py-2',
            'text-sm text-gray-200 placeholder-gray-500',
            'focus:outline-none focus:border-accent-blue',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-lg transition-colors',
            'bg-accent-blue text-white',
            'hover:bg-accent-blue/80',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-gray-600 mt-1.5">
        Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
