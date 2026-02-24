import { useState } from 'react';
import { RefreshCw, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { triggerSystemUpdate } from '../../../lib/api.ts';

type UpdateStatus = 'idle' | 'updating' | 'success' | 'error';

export function UpdateCard() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUpdate = async () => {
    setStatus('updating');
    setErrorMessage(null);
    try {
      const result = await triggerSystemUpdate();
      if (result.status === 'ok') {
        setStatus('success');
        setTimeout(() => window.location.reload(), 3000);
      } else {
        setStatus('error');
        setErrorMessage(result.message || 'Update failed');
      }
    } catch {
      // Backend may have restarted — treat fetch errors as success
      setStatus('success');
      setTimeout(() => window.location.reload(), 3000);
    }
  };

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="h-6 w-6 text-gray-100" />
        <div>
          <h2 className="text-lg font-semibold text-gray-100">System Update</h2>
          <p className="text-sm text-gray-400">Pull the latest code and restart services</p>
        </div>
      </div>

      {status === 'idle' && (
        <button
          onClick={() => void handleUpdate()}
          className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
        >
          Update Now
        </button>
      )}

      {status === 'updating' && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Pulling latest code...
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="h-4 w-4" />
          Update complete, reloading...
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
          <button
            onClick={() => setStatus('idle')}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
