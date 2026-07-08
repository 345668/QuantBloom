import { useEffect, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrchestrator, type MarketData, type NewsData, type ChartData } from '@/services/DataOrchestrator';

interface DataOrchestrationOptions {
  enableRealTime?: boolean;
  refreshInterval?: number;
  retryAttempts?: number;
  cacheStrategy?: 'aggressive' | 'conservative' | 'real-time';
}

export function useMarketData(symbol: string, options: DataOrchestrationOptions = {}) {
  const {
    enableRealTime = true,
    refreshInterval = 15000,
    retryAttempts = 3,
    cacheStrategy = 'conservative'
  } = options;

  const [realtimeData, setRealtimeData] = useState<MarketData | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['market-data-orchestrated', symbol],
    queryFn: () => dataOrchestrator.orchestrateMarketData(symbol),
    refetchInterval: refreshInterval,
    retry: retryAttempts,
    staleTime: cacheStrategy === 'real-time' ? 0 : cacheStrategy === 'aggressive' ? 60000 : 30000,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!enableRealTime) return;

    const handleRealtimeUpdate = (data: MarketData) => {
      setRealtimeData(data);
      queryClient.setQueryData(['market-data-orchestrated', symbol], data);
    };

    dataOrchestrator.subscribe(`market_${symbol}`, handleRealtimeUpdate);

    return () => {
      dataOrchestrator.unsubscribe(`market_${symbol}`, handleRealtimeUpdate);
    };
  }, [symbol, enableRealTime, queryClient]);

  const invalidateCache = useCallback(() => {
    dataOrchestrator.invalidateCache(`market_${symbol}`);
    queryClient.invalidateQueries({ queryKey: ['market-data-orchestrated', symbol] });
  }, [symbol, queryClient]);

  return {
    data: realtimeData || query.data,
    isLoading: query.isLoading,
    error: query.error,
    isStale: query.isStale,
    invalidateCache,
    validationErrors: dataOrchestrator.getValidationErrors(),
    sourceHealth: dataOrchestrator.getSourceHealth(),
  };
}

export function useNewsData(symbol?: string, options: DataOrchestrationOptions = {}) {
  const {
    enableRealTime = true,
    refreshInterval = 60000,
    retryAttempts = 2,
    cacheStrategy = 'conservative'
  } = options;

  const [realtimeData, setRealtimeData] = useState<NewsData[] | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['news-data-orchestrated', symbol || 'general'],
    queryFn: () => dataOrchestrator.orchestrateNewsData(symbol),
    refetchInterval: refreshInterval,
    retry: retryAttempts,
    staleTime: cacheStrategy === 'real-time' ? 0 : cacheStrategy === 'aggressive' ? 120000 : 60000,
  });

  useEffect(() => {
    if (!enableRealTime) return;

    const handleRealtimeUpdate = (data: NewsData[]) => {
      setRealtimeData(data);
      queryClient.setQueryData(['news-data-orchestrated', symbol || 'general'], data);
    };

    dataOrchestrator.subscribe(`news_${symbol || 'general'}`, handleRealtimeUpdate);

    return () => {
      dataOrchestrator.unsubscribe(`news_${symbol || 'general'}`, handleRealtimeUpdate);
    };
  }, [symbol, enableRealTime, queryClient]);

  const invalidateCache = useCallback(() => {
    dataOrchestrator.invalidateCache(`news_${symbol || 'general'}`);
    queryClient.invalidateQueries({ queryKey: ['news-data-orchestrated', symbol || 'general'] });
  }, [symbol, queryClient]);

  return {
    data: realtimeData || query.data,
    isLoading: query.isLoading,
    error: query.error,
    isStale: query.isStale,
    invalidateCache,
    validationErrors: dataOrchestrator.getValidationErrors(),
    sourceHealth: dataOrchestrator.getSourceHealth(),
  };
}

export function useChartData(symbol: string, timeframe: string = '1d', options: DataOrchestrationOptions = {}) {
  const {
    enableRealTime = true,
    refreshInterval = 30000,
    retryAttempts = 3,
    cacheStrategy = 'conservative'
  } = options;

  const [realtimeData, setRealtimeData] = useState<ChartData[] | null>(null);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['chart-data-orchestrated', symbol, timeframe],
    queryFn: () => dataOrchestrator.orchestrateChartData(symbol, timeframe),
    refetchInterval: refreshInterval,
    retry: retryAttempts,
    staleTime: cacheStrategy === 'real-time' ? 0 : cacheStrategy === 'aggressive' ? 60000 : 30000,
  });

  useEffect(() => {
    if (!enableRealTime) return;

    const handleRealtimeUpdate = (data: ChartData[]) => {
      setRealtimeData(data);
      queryClient.setQueryData(['chart-data-orchestrated', symbol, timeframe], data);
    };

    dataOrchestrator.subscribe(`chart_${symbol}_${timeframe}`, handleRealtimeUpdate);

    return () => {
      dataOrchestrator.unsubscribe(`chart_${symbol}_${timeframe}`, handleRealtimeUpdate);
    };
  }, [symbol, timeframe, enableRealTime, queryClient]);

  const invalidateCache = useCallback(() => {
    dataOrchestrator.invalidateCache(`chart_${symbol}_${timeframe}`);
    queryClient.invalidateQueries({ queryKey: ['chart-data-orchestrated', symbol, timeframe] });
  }, [symbol, timeframe, queryClient]);

  return {
    data: realtimeData || query.data,
    isLoading: query.isLoading,
    error: query.error,
    isStale: query.isStale,
    invalidateCache,
    validationErrors: dataOrchestrator.getValidationErrors(),
    sourceHealth: dataOrchestrator.getSourceHealth(),
  };
}

export function useDataOrchestrationHealth() {
  const [health, setHealth] = useState(dataOrchestrator.getSourceHealth());
  const [cacheStats, setCacheStats] = useState(dataOrchestrator.getCacheStats());
  const [validationErrors, setValidationErrors] = useState(dataOrchestrator.getValidationErrors());

  useEffect(() => {
    const interval = setInterval(() => {
      setHealth(dataOrchestrator.getSourceHealth());
      setCacheStats(dataOrchestrator.getCacheStats());
      setValidationErrors(dataOrchestrator.getValidationErrors());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const invalidateAllCache = useCallback(() => {
    dataOrchestrator.invalidateCache();
  }, []);

  return {
    sourceHealth: health,
    cacheStats,
    validationErrors,
    invalidateAllCache,
  };
}