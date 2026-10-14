import { useState, useCallback, useEffect } from 'react';
import { UploadQueueItem } from '../services/mockData';
import { storage } from '../services/storage';
import { api } from '../services/api';

export function useUploadQueue() {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const loadQueue = useCallback(async () => {
    const q = await storage.getUploadQueue();
    setQueue(q);
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const addToQueue = useCallback(
    async (item: Omit<UploadQueueItem, 'retries' | 'createdAt' | 'status' | 'attempts'>) => {
      const fullItem: UploadQueueItem = {
        ...item,
        status: 'pending',
        retries: 0,
        attempts: 0,
        createdAt: Date.now(),
      };
      await storage.addToQueue(fullItem);
      setQueue((q) => [...q, fullItem]);
    },
    [],
  );

  const uploadAll = useCallback(async () => {
    setUploading(true);
    const q = await storage.getUploadQueue();
    const updated = [...q];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.status === 'done') continue;

      updated[i] = { ...item, status: 'uploading' };
      setQueue([...updated]);

      try {
        const payload = item.payload || item.data;
        if (item.type === 'event' && payload) {
          await api.postEvents([payload]);
        } else if (item.type === 'track' && payload) {
          await api.postTrack(payload);
        } else if (item.type === 'report' && payload) {
          await api.postReport(payload);
        }
        updated[i] = { ...item, status: 'done' };
      } catch {
        const retries = (item.retries ?? item.attempts ?? 0) + 1;
        updated[i] = { ...item, status: 'failed', retries, attempts: retries };
      }
      setQueue([...updated]);
    }

    await storage.saveUploadQueue(updated);
    setUploading(false);
  }, []);

  const pendingCount = queue.filter(
    (i) => i.status === 'pending' || i.status === 'failed',
  ).length;

  return { queue, uploading, pendingCount, uploadAll, addToQueue, loadQueue };
}
