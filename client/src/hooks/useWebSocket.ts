import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export function useWebSocket(url: string = '/api/ws') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const queryClient = useQueryClient();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const connect = () => {
      try {
        // Construct WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}${url}`;
        
        wsRef.current = new WebSocket(wsUrl);

        wsRef.current.onopen = () => {
          console.log('WebSocket connected');
          setIsConnected(true);
          
          // Clear any existing reconnect timeout
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
          }
        };

        wsRef.current.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            setLastMessage(message);
            
            // Handle different message types
            switch (message.type) {
              case 'market_update':
                // Invalidate market indices query
                queryClient.invalidateQueries({ queryKey: ['/api/market/indices'] });
                break;
                
              case 'stock_update':
                // Invalidate watchlist and portfolio queries
                queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
                queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
                break;
                
              case 'crypto_update':
                // Invalidate crypto-related queries
                queryClient.invalidateQueries({ queryKey: ['/api/crypto/markets'] });
                queryClient.invalidateQueries({ queryKey: ['/api/crypto/trending'] });
                break;
                
              case 'crypto_trending':
                // Invalidate crypto trending queries
                queryClient.invalidateQueries({ queryKey: ['/api/crypto/trending'] });
                console.log('Crypto trending data updated:', message.data);
                break;
                
              case 'alert_triggered':
                // Handle triggered alerts - show notification and update UI
                console.log('Alert triggered:', message.data);
                
                // Invalidate alerts queries to update UI with latest triggered alerts
                queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
                queryClient.invalidateQueries({ queryKey: ['/api/alerts/triggered'] });
                
                // Show browser notification if supported and permitted
                if ('Notification' in window && Notification.permission === 'granted') {
                  const alert = message.data.alert;
                  const notification = new Notification(`${alert.type.toUpperCase()} Alert: ${alert.symbol}`, {
                    body: message.data.triggerReason,
                    icon: '/favicon.ico',
                    tag: `alert-${alert.id}`,
                    requireInteraction: true
                  });
                  
                  // Auto-close after 10 seconds
                  setTimeout(() => notification.close(), 10000);
                } else if ('Notification' in window && Notification.permission !== 'denied') {
                  // Request permission for future notifications
                  Notification.requestPermission();
                }
                break;
                
              case 'market_status':
                // Handle market status updates
                console.log('Market status:', message.data);
                break;
                
              default:
                console.log('Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        wsRef.current.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          setIsConnected(false);
          
          // Attempt to reconnect after 3 seconds
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('Attempting to reconnect WebSocket...');
              connect();
            }, 3000);
          }
        };

        wsRef.current.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
        };

      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setIsConnected(false);
        
        // Retry connection after 5 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 5000);
        }
      }
    };

    connect();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [url, queryClient]);

  const sendMessage = (message: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket is not connected');
    }
  };

  return {
    isConnected,
    lastMessage,
    sendMessage
  };
}