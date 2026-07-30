import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';

export interface PhaseStatusMap {
  settings: 'complete' | 'in_progress' | 'skipped' | 'pending';
  outline: 'complete' | 'in_progress' | 'skipped' | 'pending';
  prompt: 'complete' | 'in_progress' | 'skipped' | 'pending';
  write: 'complete' | 'in_progress' | 'skipped' | 'pending';
  archive: 'complete' | 'in_progress' | 'skipped' | 'pending';
}

export interface GateWarning {
  phase: string;
  message: string;
}

export function useNovelState(novelId: string | undefined) {
  const [phaseStatus, setPhaseStatus] = useState<PhaseStatusMap | null>(null);
  const [warnings, setWarnings] = useState<GateWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPhaseStatus = useCallback(async () => {
    if (!novelId) return;
    setLoading(true);
    setError(false);
    try {
      const res = await api.get(`/novels/${novelId}/phase-status`);
      setPhaseStatus(res.phases);
      setWarnings(res.warnings || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [novelId]);

  useEffect(() => { fetchPhaseStatus(); }, [fetchPhaseStatus]);

  return { phaseStatus, warnings, loading, error, refetch: fetchPhaseStatus };
}
