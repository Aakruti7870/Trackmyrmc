import { useEffect, useRef, useState } from 'react';

export type SSEStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

type Handler = (data: unknown) => void;

export function useSSE() {
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const unmounted = useRef(false);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;
      setStatus(retryCount.current === 0 ? 'connecting' : 'reconnecting');

      const token = localStorage.getItem('rmc_token');
      const url = `/api/events${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        if (unmounted.current) return;
        retryCount.current = 0;
        setStatus('connected');
      };

      es.onerror = () => {
        if (unmounted.current) return;
        es.close();
        esRef.current = null;
        setStatus('reconnecting');
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      es.addEventListener('challan.created', (e: MessageEvent) => {
        dispatch('challan.created', JSON.parse(e.data));
      });

      es.addEventListener('challan.updated', (e: MessageEvent) => {
        dispatch('challan.updated', JSON.parse(e.data));
      });

      es.addEventListener('ping', () => {});
    }

    function dispatch(event: string, data: unknown) {
      const handlers = handlersRef.current.get(event);
      if (handlers) handlers.forEach(h => h(data));
    }

    connect();

    return () => {
      unmounted.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      esRef.current?.close();
      esRef.current = null;
      setStatus('closed');
    };
  }, []);

  function subscribe(event: string, handler: Handler) {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }

  return { status, subscribe };
}
