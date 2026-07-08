import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, TrendingUp, DollarSign, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface EarningsEvent {
  symbol: string;
  date: string;
  epsEstimate: number;
  epsActual: number | null;
  revenueEstimate: number;
  revenueActual: number | null;
  hour: string;
  quarter: number;
  year: number;
}

interface EarningsCalendarProps {
  onSymbolClick?: (symbol: string) => void;
}

export default function EarningsCalendar({ onSymbolClick }: EarningsCalendarProps = {}) {
  const { data: earnings, isLoading, error } = useQuery<EarningsEvent[]>({
    queryKey: ['/api/finnhub/earnings-calendar'],
    refetchInterval: 300000
  });

  const upcomingEarnings = earnings?.filter(e => !e.epsActual) || [];
  const recentEarnings = earnings?.filter(e => e.epsActual !== null) || [];

  const formatRevenue = (value: number | null) => {
    if (!value) return 'N/A';
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
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
              <Skeleton key={i} className="h-20 w-full" />
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
            <Calendar className="h-5 w-5" />
            Earnings Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Unable to load earnings calendar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Earnings Calendar
        </CardTitle>
        <CardDescription>
          Upcoming company earnings reports
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          {upcomingEarnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-foreground">Upcoming</h3>
              <div className="space-y-2">
                {upcomingEarnings.slice(0, 10).map((earning, idx) => (
                  <div
                    key={`${earning.symbol}-${earning.date}-${idx}`}
                    className="p-3 rounded-md bg-card border hover-elevate"
                    data-testid={`earnings-upcoming-${earning.symbol}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <a
                            href={`https://finance.yahoo.com/quote/${earning.symbol}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-semibold text-sm hover-elevate cursor-pointer p-1 rounded-sm"
                            onClick={() => onSymbolClick?.(earning.symbol)}
                            data-testid={`button-symbol-${earning.symbol}`}
                          >
                            {earning.symbol}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                          <Badge variant="secondary" className="text-xs">
                            {earning.hour === 'bmo' ? 'Before Open' : 
                             earning.hour === 'amc' ? 'After Close' : 
                             'During Market'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(earning.date), 'MMM dd, yyyy')}
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            EPS Est: ${earning.epsEstimate?.toFixed(2) || 'N/A'}
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            Rev Est: {formatRevenue(earning.revenueEstimate)}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        Q{earning.quarter} {earning.year}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentEarnings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-foreground">Recent Results</h3>
              <div className="space-y-2">
                {recentEarnings.slice(0, 10).map((earning, idx) => {
                  const epsBeat = earning.epsActual && earning.epsEstimate && 
                    earning.epsActual > earning.epsEstimate;
                  const epsMiss = earning.epsActual && earning.epsEstimate && 
                    earning.epsActual < earning.epsEstimate;

                  return (
                    <div
                      key={`${earning.symbol}-${earning.date}-recent-${idx}`}
                      className="p-3 rounded-md bg-card border hover-elevate"
                      data-testid={`earnings-recent-${earning.symbol}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <a
                              href={`https://finance.yahoo.com/quote/${earning.symbol}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 font-semibold text-sm hover-elevate cursor-pointer p-1 rounded-sm"
                              onClick={() => onSymbolClick?.(earning.symbol)}
                              data-testid={`button-symbol-${earning.symbol}`}
                            >
                              {earning.symbol}
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </a>
                            {epsBeat && (
                              <Badge variant="default" className="text-xs bg-green-500/20 text-green-400 border-green-500/30">
                                Beat
                              </Badge>
                            )}
                            {epsMiss && (
                              <Badge variant="default" className="text-xs bg-red-500/20 text-red-400 border-red-500/30">
                                Miss
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(earning.date), 'MMM dd, yyyy')}
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              EPS: ${earning.epsActual?.toFixed(2)} vs ${earning.epsEstimate?.toFixed(2)} est
                            </div>
                            {earning.revenueActual && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                Rev: {formatRevenue(earning.revenueActual)}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs whitespace-nowrap">
                          Q{earning.quarter} {earning.year}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {upcomingEarnings.length === 0 && recentEarnings.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No earnings data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
