import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldOff, X } from 'lucide-react';
import { fetchEnvironment } from '../../lib/api.ts';
import type { EnvironmentResponse } from '../../lib/api.ts';

type BannerState = 'loading' | 'sandboxed' | 'blocked' | 'override' | 'error';

export function SandboxBanner() {
  const [state, setState] = useState<BannerState>('loading');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchEnvironment()
      .then((env: EnvironmentResponse) => {
        if (env.sandboxed) {
          setState('sandboxed');
        } else if (env.override_active) {
          setState('override');
        } else {
          setState('blocked');
        }
      })
      .catch(() => {
        setState('error');
      });
  }, []);

  // Render nothing for safe/loading/error states
  if (state === 'loading' || state === 'sandboxed' || state === 'error' || dismissed) {
    return null;
  }

  // Override banner (amber) — agents enabled without container
  if (state === 'override') {
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

  // Blocked banner (amber, dismissible) — dashboard works, agents don't
  return (
    <div
      role="alert"
      className="flex items-center gap-3 bg-amber-900/80 border-b border-amber-700 px-4 py-2 text-amber-200 text-sm"
    >
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        No container detected — the dashboard works normally but agent execution is disabled.
        Use a devcontainer or Docker to enable agents, or set ORCHESTRA_ALLOW_HOST=true to override.
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
