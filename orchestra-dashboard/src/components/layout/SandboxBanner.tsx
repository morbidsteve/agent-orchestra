import { useEffect, useState } from 'react';
import { Container, ShieldAlert, ShieldOff, X } from 'lucide-react';
import { fetchEnvironment } from '../../lib/api.ts';
import type { EnvironmentResponse } from '../../lib/api.ts';

type ExecutionMode = 'native' | 'docker-wrap' | 'host-override' | 'blocked';
type BannerState = 'loading' | ExecutionMode | 'error';

export function SandboxBanner() {
  const [state, setState] = useState<BannerState>('loading');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchEnvironment()
      .then((env: EnvironmentResponse) => {
        if (env.execution_mode) {
          setState(env.execution_mode);
        } else if (env.sandboxed) {
          setState('native');
        } else if (env.override_active) {
          setState('host-override');
        } else {
          setState('blocked');
        }
      })
      .catch(() => {
        setState('error');
      });
  }, []);

  // Render nothing for safe/loading/error/native states, or if dismissed
  if (state === 'loading' || state === 'native' || state === 'error' || dismissed) {
    return null;
  }

  // Docker-wrap banner (blue info, dismissible) — agents auto-containerized
  if (state === 'docker-wrap') {
    return (
      <div
        role="status"
        className="flex items-center gap-3 bg-blue-900/80 border-b border-blue-700 px-4 py-2 text-blue-200 text-sm"
      >
        <Container className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          Running on bare metal — agents will be automatically containerized via Docker.
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded hover:bg-blue-800 transition-colors"
          aria-label="Dismiss info"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Host-override banner (amber warning) — agents enabled without container
  if (state === 'host-override') {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 bg-amber-900/80 border-b border-amber-700 px-4 py-2 text-amber-200 text-sm"
      >
        <ShieldOff className="h-4 w-4 shrink-0" />
        <span className="flex-1">
          Running without container sandbox — agents have unrestricted host filesystem access.
        </span>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 p-1 rounded hover:bg-amber-800 transition-colors"
          aria-label="Dismiss warning"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Blocked banner (amber) — dashboard works, agents don't
  return (
    <div
      role="alert"
      className="flex items-center gap-3 bg-amber-900/80 border-b border-amber-700 px-4 py-2 text-amber-200 text-sm"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        No container sandbox and Docker is not available — agent execution is disabled.
        Install Docker or use a devcontainer to enable agents.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded hover:bg-amber-800 transition-colors"
        aria-label="Dismiss warning"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
