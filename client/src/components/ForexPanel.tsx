import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Globe, Coins, RefreshCw } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient } from "@/lib/queryClient";

interface ForexRate {
  pair: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
}

export default function ForexPanel() {
  const { data: forexRates, isLoading, error, refetch, isFetching } = useQuery<ForexRate[]>({
    queryKey: ['/api/finnhub/forex'],
    refetchInterval: 60000
  });

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/finnhub/forex'] });
    refetch();
  };

  const renderRateCard = (rate: ForexRate) => {
    const isPositive = rate.change >= 0;
    
    return (
      <div
        key={rate.pair}
        className="p-3 rounded-md bg-card border hover-elevate"
        data-testid={`forex-${rate.pair.replace('/', '-')}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-foreground">
                {rate.pair}
              </span>
              <Badge 
                variant={isPositive ? "default" : "destructive"}
                className={
                  isPositive 
                    ? "text-xs bg-green-500/20 text-green-400 border-green-500/30" 
                    : "text-xs bg-red-500/20 text-red-400 border-red-500/30"
                }
              >
                {isPositive ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
                {rate.changePercent?.toFixed(2)}%
              </Badge>
            </div>
            <div className="text-lg font-bold text-foreground mb-2">
              {rate.price?.toFixed(4)}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>
                <span className="text-muted-foreground">High:</span>{' '}
                <span className="text-foreground">{rate.high?.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Low:</span>{' '}
                <span className="text-foreground">{rate.low?.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Open:</span>{' '}
                <span className="text-foreground">{rate.open?.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Prev:</span>{' '}
                <span className="text-foreground">{rate.previousClose?.toFixed(4)}</span>
              </div>
            </div>
          </div>
          <div className={`text-sm font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
            {isPositive ? '+' : ''}{rate.change?.toFixed(4)}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Forex & Commodities
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Unable to load forex rates</p>
        </CardContent>
      </Card>
    );
  }

  const majorPairs = forexRates?.filter(r => 
    ['EUR/USD', 'GBP/USD', 'USD/JPY'].includes(r.pair)
  ) || [];

  const commodityCurrencies = forexRates?.filter(r => 
    ['AUD/USD', 'USD/CAD', 'NZD/USD'].includes(r.pair)
  ) || [];

  const otherPairs = forexRates?.filter(r => 
    !majorPairs.includes(r) && !commodityCurrencies.includes(r)
  ) || [];

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Forex & Commodities
            </CardTitle>
            <CardDescription>
              Real-time currency exchange rates
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-forex"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <Tabs defaultValue="major" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="major" data-testid="tab-major-pairs">
              Major Pairs
            </TabsTrigger>
            <TabsTrigger value="commodity" data-testid="tab-commodity-pairs">
              Commodity
            </TabsTrigger>
            <TabsTrigger value="all" data-testid="tab-all-pairs">
              All Rates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="major" className="flex-1 overflow-auto mt-4">
            <div className="space-y-2">
              {majorPairs.map(renderRateCard)}
              {majorPairs.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No major pairs data available</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="commodity" className="flex-1 overflow-auto mt-4">
            <div className="space-y-2">
              {commodityCurrencies.map(renderRateCard)}
              {commodityCurrencies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Coins className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No commodity currency data available</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="all" className="flex-1 overflow-auto mt-4">
            <div className="space-y-2">
              {forexRates?.map(renderRateCard)}
              {!forexRates || forexRates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No forex data available</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
