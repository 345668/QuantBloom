import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus, ThumbsUp, ThumbsDown, RefreshCw } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

interface RecommendationTrend {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface AnalystRecommendationsProps {
  symbol: string;
}

export default function AnalystRecommendations({ symbol }: AnalystRecommendationsProps) {
  const { data: recommendations, isLoading, error, refetch, isFetching } = useQuery<RecommendationTrend[]>({
    queryKey: [`/api/finnhub/recommendations/${symbol}`],
    enabled: !!symbol,
    refetchInterval: 300000
  });

  const handleRefresh = async () => {
    if (!symbol) return;
    await queryClient.invalidateQueries({ queryKey: [`/api/finnhub/recommendations/${symbol}`] });
    refetch();
  };

  const getConsensus = (rec: RecommendationTrend) => {
    const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
    if (total === 0) return { label: 'N/A', variant: 'secondary' as const, icon: Minus };

    const bullish = rec.strongBuy + rec.buy;
    const bearish = rec.sell + rec.strongSell;
    
    if (bullish > bearish + rec.hold) {
      return { label: 'Buy', variant: 'default' as const, icon: TrendingUp };
    } else if (bearish > bullish + rec.hold) {
      return { label: 'Sell', variant: 'destructive' as const, icon: TrendingDown };
    } else {
      return { label: 'Hold', variant: 'secondary' as const, icon: Minus };
    }
  };

  const getPercentage = (value: number, rec: RecommendationTrend) => {
    const total = rec.strongBuy + rec.buy + rec.hold + rec.sell + rec.strongSell;
    return total > 0 ? ((value / total) * 100).toFixed(0) : '0';
  };

  if (!symbol) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ThumbsUp className="h-5 w-5" />
            Analyst Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Select a symbol to view analyst recommendations</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !recommendations || recommendations.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5" />
                Analyst Recommendations
              </CardTitle>
              <CardDescription>{symbol}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isFetching}
              data-testid="button-refresh-recommendations"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No analyst data available for {symbol}</p>
        </CardContent>
      </Card>
    );
  }

  const latest = recommendations[0];
  const consensus = getConsensus(latest);
  const ConsensusIcon = consensus.icon;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ThumbsUp className="h-5 w-5" />
              Analyst Recommendations
            </CardTitle>
            <CardDescription>
              {symbol} • {latest.period}
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-recommendations"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
            <span className="text-sm font-medium">Consensus</span>
            <Badge variant={consensus.variant} className="flex items-center gap-1">
              <ConsensusIcon className="h-3 w-3" />
              {consensus.label}
            </Badge>
          </div>

          <div className="space-y-3">
            <div className="space-y-2" data-testid="recommendation-strong-buy">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3 text-green-500" />
                  Strong Buy
                </span>
                <span className="font-semibold">{latest.strongBuy}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500" 
                  style={{ width: `${getPercentage(latest.strongBuy, latest)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2" data-testid="recommendation-buy">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-green-400" />
                  Buy
                </span>
                <span className="font-semibold">{latest.buy}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-400" 
                  style={{ width: `${getPercentage(latest.buy, latest)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2" data-testid="recommendation-hold">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Minus className="h-3 w-3 text-yellow-500" />
                  Hold
                </span>
                <span className="font-semibold">{latest.hold}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-yellow-500" 
                  style={{ width: `${getPercentage(latest.hold, latest)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2" data-testid="recommendation-sell">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <TrendingDown className="h-3 w-3 text-red-400" />
                  Sell
                </span>
                <span className="font-semibold">{latest.sell}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-400" 
                  style={{ width: `${getPercentage(latest.sell, latest)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2" data-testid="recommendation-strong-sell">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3 text-red-500" />
                  Strong Sell
                </span>
                <span className="font-semibold">{latest.strongSell}</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-red-500" 
                  style={{ width: `${getPercentage(latest.strongSell, latest)}%` }}
                />
              </div>
            </div>
          </div>

          {recommendations.length > 1 && (
            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Historical Trends</p>
              <div className="space-y-1.5">
                {recommendations.slice(1, 4).map((rec, idx) => {
                  const cons = getConsensus(rec);
                  const Icon = cons.icon;
                  return (
                    <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30">
                      <span className="text-muted-foreground">{rec.period}</span>
                      <Badge variant={cons.variant} className="text-xs flex items-center gap-1">
                        <Icon className="h-2.5 w-2.5" />
                        {cons.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
