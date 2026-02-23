import { cn } from '../../../lib/cn.ts';
import type { FindingSeverity, FindingType, FindingStatus } from '../../../lib/types';

interface FindingsFiltersProps {
  filters: {
    severity: FindingSeverity | null;
    type: FindingType | null;
    status: FindingStatus | null;
  };
  setSeverity: (s: FindingSeverity | null) => void;
  setType: (t: FindingType | null) => void;
  setStatus: (s: FindingStatus | null) => void;
  clearFilters: () => void;
}

const severities: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
const types: FindingType[] = ['security', 'quality', 'performance', 'compliance'];
const statuses: FindingStatus[] = ['open', 'resolved', 'dismissed'];

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: T[];
  selected: T | null;
  onSelect: (value: T | null) => void;
}) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onSelect(selected === option ? null : option)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize',
              selected === option
                ? 'bg-accent-blue text-white'
                : 'bg-surface-700 text-gray-400 hover:bg-surface-600 hover:text-gray-300',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FindingsFilters({ filters, setSeverity, setType, setStatus, clearFilters }: FindingsFiltersProps) {
  const hasFilters = filters.severity || filters.type || filters.status;

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-200">Filters</h2>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Clear all
          </button>
        )}
      </div>
      <FilterGroup label="Severity" options={severities} selected={filters.severity} onSelect={setSeverity} />
      <FilterGroup label="Type" options={types} selected={filters.type} onSelect={setType} />
      <FilterGroup label="Status" options={statuses} selected={filters.status} onSelect={setStatus} />
    </div>
  );
}
