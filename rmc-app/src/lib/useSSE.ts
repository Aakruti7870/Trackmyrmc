import { useEffect, useRef, useState, useCallback } from 'react';

export type SSEStatus = 'connecting' | 'connected' | 'reconnecting' | 'closed';

type Handler = (data: unknown) => void;

const MAX_RETRIES = 12;

export function useSSE() {
  const [status, setStatus] = useState<SSEStatus>('connecting');
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const esRef = useRef<EventSource | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const unmounted = useRef(false);
  const connectRef = useRef<() => void>(() => {});

  const reconnect = useCallback(() => {
    retryCount.current = 0;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    esRef.current?.close();
    esRef.current = null;
    setStatus('connecting');
    connectRef.current();
  }, []);

  useEffect(() => {
    unmounted.current = false;

    function connect() {
      if (unmounted.current) return;

      const token = localStorage.getItem('rmc_token');
      if (!token) {
        setStatus('closed');
        return;
      }

      setStatus(retryCount.current === 0 ? 'connecting' : 'reconnecting');

      const url = `/api/events?token=${encodeURIComponent(token)}`;
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

        if (retryCount.current >= MAX_RETRIES) {
          setStatus('closed');
          return;
        }

        setStatus('reconnecting');
        const delay = Math.min(1000 * 2 ** retryCount.current, 30000);
        retryCount.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      es.addEventListener('challan.created', (e: MessageEvent) => {
        dispatchEvent('challan.created', JSON.parse(e.data));
      });

      es.addEventListener('challan.updated', (e: MessageEvent) => {
        dispatchEvent('challan.updated', JSON.parse(e.data));
      });

      es.addEventListener('ping', () => {});
    }

    connectRef.current = connect;

    function dispatchEvent(event: string, data: unknown) {
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

  return { status, subscribe, reconnect };
}
