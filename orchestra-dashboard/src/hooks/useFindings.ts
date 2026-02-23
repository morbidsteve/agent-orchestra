import { useState, useMemo, useCallback } from 'react';
import { useOrchestra } from '../context/OrchestraContext.tsx';
import type { FindingSeverity, FindingType, FindingStatus } from '../lib/types';

interface FindingsFilters {
  severity: FindingSeverity | null;
  type: FindingType | null;
  status: FindingStatus | null;
}

export function useFindings() {
  const { findings } = useOrchestra();
  const [filters, setFilters] = useState<FindingsFilters>({
    severity: null,
    type: null,
    status: null,
  });

  const filtered = useMemo(() => {
    return findings.filter(f => {
      if (filters.severity && f.severity !== filters.severity) return false;
      if (filters.type && f.type !== filters.type) return false;
      if (filters.status && f.status !== filters.status) return false;
      return true;
    });
  }, [findings, filters]);

  const setSeverity = useCallback((s: FindingSeverity | null) => {
    setFilters(prev => ({ ...prev, severity: s }));
  }, []);

  const setType = useCallback((t: FindingType | null) => {
    setFilters(prev => ({ ...prev, type: t }));
  }, []);

  const setStatus = useCallback((st: FindingStatus | null) => {
    setFilters(prev => ({ ...prev, status: st }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({ severity: null, type: null, status: null });
  }, []);

  const stats = useMemo(() => ({
    total: findings.length,
    open: findings.filter(f => f.status === 'open').length,
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
  }), [findings]);

  return {
    findings: filtered,
    allFindings: findings,
    filters,
    setSeverity,
    setType,
    setStatus,
    clearFilters,
    stats,
  };
}
