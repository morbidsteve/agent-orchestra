import { useState, useRef, useCallback, useEffect } from 'react';
import { Send, ChevronDown, ChevronUp, GitBranch, FolderOpen } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { MODELS } from '../../../lib/constants.ts';
import { useConversationContext } from '../../../context/ConversationContext.tsx';

interface ConsoleInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  model: string;
  onModelChange: (model: string) => void;
}

export function ConsoleInput({ onSend, disabled, model, onModelChange }: ConsoleInputProps) {
  const [text, setText] = useState('');
  const [showOptions, setShowOptions] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { githubUrl, setGithubUrl, folderPath, setFolderPath } = useConversationContext();

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
      {/* Collapsible options row */}
      <button
        type="button"
        onClick={() => setShowOptions(!showOptions)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-400 transition-colors mb-2"
      >
        {showOptions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        Options
      </button>

      {showOptions && (
        <div className="space-y-2 mb-2 pb-2 border-b border-surface-600">
          {/* Model selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="model-select" className="text-xs text-gray-500">Model</label>
              <select
                id="model-select"
                value={model}
                onChange={(e) => onModelChange(e.target.value)}
                className="bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-accent-blue"
              >
                {MODELS.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* GitHub URL input */}
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <input
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="GitHub URL (optional)"
              className="flex-1 bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
            />
          </div>

          {/* Local folder path input */}
          <div className="flex items-center gap-2">
            <FolderOpen className="h-3.5 w-3.5 text-gray-500 shrink-0" />
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="Local folder path (optional)"
              className="flex-1 bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
            />
          </div>
        </div>
      )}

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
