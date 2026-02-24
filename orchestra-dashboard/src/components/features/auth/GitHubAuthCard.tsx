import { useState } from 'react';
import { Copy, Check, ExternalLink, Github, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { AuthStatus, GitHubLoginStatus } from '../../../lib/types.ts';

export interface GitHubAuthCardProps {
  authStatus: AuthStatus | null;
  loginSession: GitHubLoginStatus | null;
  loading: boolean;
  loginInProgress: boolean;
  onLogin: () => void;
  onLogout?: () => void;
  error: string | null;
  compact?: boolean;
}

export function GitHubAuthCard({
  authStatus,
  loginSession,
  loading,
  loginInProgress,
  onLogin,
  onLogout,
  error,
  compact = false,
}: GitHubAuthCardProps) {
  const [copied, setCopied] = useState(false);

  const githubConnected = authStatus?.github?.authenticated ?? false;
  const deviceCode = loginSession?.deviceCode;

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const authBody = (
    <>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking status...
        </div>
      ) : githubConnected ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">
            Signed in as <span className="font-medium text-gray-100">{authStatus?.github?.username}</span>
          </p>
          {onLogout && (
            <button
              onClick={() => void onLogout()}
              className="rounded-lg border border-surface-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-surface-700 transition-colors"
            >
              Disconnect
            </button>
          )}
        </div>
      ) : loginInProgress && deviceCode ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-300">
            Enter this code on GitHub to complete authentication:
          </p>
          <div className="flex items-center gap-3">
            <code className="rounded-lg bg-surface-700 px-4 py-3 text-2xl font-mono font-bold text-gray-100 tracking-wider">
              {deviceCode}
            </code>
            <button
              onClick={() => void handleCopyCode(deviceCode)}
              className="rounded-lg border border-surface-600 p-2 text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors"
              title="Copy code"
            >
              {copied ? <Check className="h-5 w-5 text-green-400" /> : <Copy className="h-5 w-5" />}
            </button>
          </div>
          <a
            href="https://github.com/login/device"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
          >
            Open GitHub
            <ExternalLink className="h-4 w-4" />
          </a>
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
            Connect GitHub
          </button>
          {(error || loginSession?.error) && (
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error || loginSession?.error}
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
          <Github className="h-6 w-6 text-gray-100" />
          <div>
            <h2 className="text-lg font-semibold text-gray-100">GitHub</h2>
            <p className="text-sm text-gray-400">Connect your GitHub account for repository access</p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
            githubConnected
              ? 'bg-green-400/10 text-green-400'
              : 'bg-gray-400/10 text-gray-400',
          )}
        >
          {githubConnected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      {authBody}
    </div>
  );
}
