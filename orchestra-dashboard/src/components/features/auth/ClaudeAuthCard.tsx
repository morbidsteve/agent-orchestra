import { useState } from 'react';
import { Bot, ExternalLink, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { AuthStatus, ClaudeLoginStatus } from '../../../lib/types.ts';

export interface ClaudeAuthCardProps {
  authStatus: AuthStatus | null;
  claudeLoginSession: ClaudeLoginStatus | null;
  loading: boolean;
  claudeLoginInProgress: boolean;
  onLogin: () => void;
  onSubmitCode?: (code: string) => void;
  error: string | null;
  compact?: boolean;
}

function CodeInput({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      onSubmit(code.trim());
      setSubmitted(true);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verifying code...
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="claude-auth-code" className="block text-sm text-gray-300">
        Paste the code from the authorization page:
      </label>
      <div className="flex gap-2">
        <input
          id="claude-auth-code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Enter code"
          className="flex-1 rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue"
          autoFocus
        />
        <button
          type="submit"
          disabled={!code.trim()}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit
        </button>
      </div>
    </form>
  );
}

export function ClaudeAuthCard({
  authStatus,
  claudeLoginSession,
  loading,
  claudeLoginInProgress,
  onLogin,
  onSubmitCode,
  error,
  compact = false,
}: ClaudeAuthCardProps) {
  const claudeConnected = authStatus?.claude?.authenticated ?? false;
  const claudeAuthUrl = claudeLoginSession?.authUrl;

  const authBody = (
    <>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking status...
        </div>
      ) : claudeConnected ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">
            {authStatus?.claude?.email ? (
              <>Authenticated as <span className="font-medium text-gray-100">{authStatus.claude.email}</span></>
            ) : (
              <>Claude Code CLI is authenticated and ready.</>
            )}
          </p>
        </div>
      ) : claudeLoginInProgress && claudeAuthUrl ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Open the link below to authorize Claude Code:
          </p>
          <a
            href={claudeAuthUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
          >
            Open Authorization Page
            <ExternalLink className="h-4 w-4" />
          </a>
          {onSubmitCode && (
            <CodeInput onSubmit={onSubmitCode} />
          )}
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Waiting for authorization...
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <button
            onClick={() => void onLogin()}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
          >
            Connect Claude
          </button>
          {(error || claudeLoginSession?.error) && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error || claudeLoginSession?.error}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (compact) {
    return authBody;
  }

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Bot className="h-6 w-6 text-gray-100" />
          <div>
            <h2 className="text-lg font-semibold text-gray-100">Claude Code</h2>
            <p className="text-sm text-gray-400">Claude Code CLI authentication status</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            claudeConnected
              ? 'bg-green-400/10 text-green-400'
              : 'bg-gray-400/10 text-gray-400',
          )}
        >
          {claudeConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {authBody}
    </div>
  );
}
