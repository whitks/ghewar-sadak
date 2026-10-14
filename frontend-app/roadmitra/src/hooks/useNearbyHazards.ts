import { useState, useCallback } from 'react';
import { Hazard, MOCK_HAZARDS } from '../services/mockData';
import { api } from '../services/api';

export function useNearbyHazards() {
  const [hazards, setHazards] = useState<Hazard[]>(MOCK_HAZARDS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHazards = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getNearbyHazards(lat, lon);
      if (data && data.length > 0) {
        setHazards(data);
      }
    } catch {
      setError('Could not connect to server. Displaying cached hazard records.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { hazards, loading, error, fetchHazards };
}
