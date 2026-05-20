import { useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

type QueueItem<T> = {
  id: number;
  promise: Promise<T>;
};

/**
 * A betting queue that instantly accepts bets without blocking the UI.
 * Processes bets sequentially in the background.
 */
export function useBetQueue() {
  const queryClient = useQueryClient();
  const counterRef = useRef(0);
  const processingRef = useRef(false);
  const queueRef = useRef<Array<() => Promise<any>>>([]);
  const [pending, setPending] = useState(0);
  const [lastResult, setLastResult] = useState<any>(null);

  const enqueue = useCallback((betFn: () => Promise<any>) => {
    queueRef.current.push(betFn);
    setPending(queueRef.current.length);

    if (!processingRef.current) {
      processQueue();
    }
  }, []);

  async function processQueue() {
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const betFn = queueRef.current.shift()!;
      setPending(queueRef.current.length);

      try {
        const result = await betFn();
        setLastResult(result);
        queryClient.invalidateQueries({ queryKey: ['user'] });
      } catch {
        // Individual bet failure doesn't stop the queue
      }
    }

    processingRef.current = false;
    setPending(0);
  }

  return { enqueue, pending, lastResult, setLastResult };
}
