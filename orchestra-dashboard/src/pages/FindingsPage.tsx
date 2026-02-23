import { useFindings } from '../hooks/useFindings.ts';
import { FindingsFilters, FindingsTable } from '../components/features/findings/index.ts';
import { AlertTriangle, ShieldAlert } from 'lucide-react';

export function FindingsPage() {
  const { findings, filters, setSeverity, setType, setStatus, clearFilters, stats } = useFindings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Findings</h1>
        <div className="flex items-center gap-4 mt-1">
          <p className="text-gray-400">{stats.total} total findings</p>
          {stats.critical > 0 && (
            <span className="flex items-center gap-1 text-sm text-red-400">
              <ShieldAlert className="h-4 w-4" />
              {stats.critical} critical
            </span>
          )}
          {stats.high > 0 && (
            <span className="flex items-center gap-1 text-sm text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              {stats.high} high
            </span>
          )}
          <span className="text-sm text-amber-400">{stats.open} open</span>
        </div>
      </div>

      <FindingsFilters
        filters={filters}
        setSeverity={setSeverity}
        setType={setType}
        setStatus={setStatus}
        clearFilters={clearFilters}
      />

      <FindingsTable findings={findings} />
    </div>
  );
}
