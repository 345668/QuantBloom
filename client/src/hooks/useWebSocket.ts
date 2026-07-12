import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface LiveUpdateMessage {
  type: string;
  data: any;
  timestamp: Date;
}

// Polling intervals (ms)
const MARKET_POLL_INTERVAL = 30_000; // market indices, watchlist, portfolio, crypto
const ALERTS_POLL_INTERVAL = 60_000; // triggered alerts

/**
 * Live updates via polling.
 *
 * WebSockets are not supported on Vercel serverless functions, so this hook
 * keeps data fresh by periodically invalidating the relevant React Query
 * caches. It preserves the same public interface as the previous
 * WebSocket-based implementation so consumers don't need to change.
 */
export function useWebSocket(_url: string = '/api/ws') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<LiveUpdateMessage | null>(null);
  const queryClient = useQueryClient();
  const seenAlertIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setIsConnected(true);

    // Poll market data: indices, watchlist, portfolio, crypto
    const marketInterval = setInterval(() => {
      // Skip polling when the tab is hidden to save resources
      if (document.hidden) return;

      queryClient.invalidateQueries({ queryKey: ['/api/market/indices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crypto/markets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crypto/trending'] });

      setLastMessage({
        type: 'market_update',
        data: null,
        timestamp: new Date(),
      });
    }, MARKET_POLL_INTERVAL);

    // Poll triggered alerts and surface browser notifications for new ones
    const alertsInterval = setInterval(async () => {
      if (document.hidden) return;

      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });

      try {
        const res = await fetch('/api/alerts/triggered');
        if (!res.ok) return;
        const triggered = await res.json();
        if (!Array.isArray(triggered)) return;

        for (const item of triggered) {
          const id = String(item?.alert?.id ?? item?.id ?? '');
          if (!id || seenAlertIdsRef.current.has(id)) continue;
          seenAlertIdsRef.current.add(id);

          setLastMessage({
            type: 'alert_triggered',
            data: item,
            timestamp: new Date(),
          });

          // Show browser notification if supported and permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            const alert = item.alert ?? item;
            const notification = new Notification(
              `${String(alert.type ?? 'PRICE').toUpperCase()} Alert: ${alert.symbol ?? ''}`,
              {
                body: item.triggerReason ?? 'Alert condition met',
                icon: '/favicon.ico',
                tag: `alert-${id}`,
                requireInteraction: true,
              }
            );
            // Auto-close after 10 seconds
            setTimeout(() => notification.close(), 10000);
          } else if ('Notification' in window && Notification.permission !== 'denied') {
            // Request permission for future notifications
            Notification.requestPermission();
          }
        }

        queryClient.invalidateQueries({ queryKey: ['/api/alerts/triggered'] });
      } catch {
        // Network hiccup; next poll will retry
      }
    }, ALERTS_POLL_INTERVAL);

    return () => {
      clearInterval(marketInterval);
      clearInterval(alertsInterval);
      setIsConnected(false);
    };
  }, [queryClient]);

  const sendMessage = (_message: any) => {
    // No-op: server push is replaced by polling in the serverless deployment
  };

  return {
    isConnected,
    lastMessage,
    sendMessage,
  };
}
