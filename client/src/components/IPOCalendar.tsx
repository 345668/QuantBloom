import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Calendar, TrendingUp, DollarSign, ExternalLink } from "lucide-react";
import { format } from "date-fns";

interface IPOEvent {
  symbol: string;
  name: string;
  date: string;
  exchange: string;
  price: string | number;
  numberOfShares: string | number;
  totalSharesValue: string | number;
  status: string;
}

interface IPOCalendarProps {
  onSymbolClick?: (symbol: string) => void;
}

export default function IPOCalendar({ onSymbolClick }: IPOCalendarProps = {}) {
  const { data: ipos, isLoading, error } = useQuery<IPOEvent[]>({
    queryKey: ['/api/finnhub/ipo-calendar'],
    refetchInterval: 300000
  });

  const upcomingIPOs = ipos?.filter(ipo => {
    const ipoDate = new Date(ipo.date);
    return ipoDate >= new Date();
  }) || [];

  const recentIPOs = ipos?.filter(ipo => {
    const ipoDate = new Date(ipo.date);
    return ipoDate < new Date();
  }) || [];

  const formatPrice = (value: string | number | null | undefined): string => {
    if (!value) return 'TBD';
    if (typeof value === 'string') return value;
    return value.toFixed(2);
  };

  const formatMarketCap = (value: string | number | null | undefined): string => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return value;
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const formatShares = (value: string | number | null | undefined): string => {
    if (!value) return 'N/A';
    if (typeof value === 'string') return value;
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(0);
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
            <Rocket className="h-5 w-5" />
            IPO Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Unable to load IPO calendar</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          IPO Calendar
        </CardTitle>
        <CardDescription>
          Upcoming and recent initial public offerings
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          {upcomingIPOs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-foreground">Upcoming IPOs</h3>
              <div className="space-y-2">
                {upcomingIPOs.slice(0, 8).map((ipo, idx) => (
                  <div
                    key={`${ipo.symbol}-${ipo.date}-${idx}`}
                    className="p-3 rounded-md bg-card border hover-elevate"
                    data-testid={`ipo-upcoming-${ipo.symbol}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {ipo.name}
                        </h4>
                        <a
                          href={`https://finance.yahoo.com/quote/${ipo.symbol}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs hover-elevate cursor-pointer p-1 rounded-sm"
                          onClick={() => onSymbolClick?.(ipo.symbol)}
                          data-testid={`button-symbol-${ipo.symbol}`}
                        >
                          {ipo.symbol}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {ipo.exchange}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ipo.date), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatPrice(ipo.price)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {formatShares(ipo.numberOfShares)} shares
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatMarketCap(ipo.totalSharesValue)}
                      </div>
                    </div>
                    {ipo.status && (
                      <div className="mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {ipo.status}
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentIPOs.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2 text-foreground">Recent IPOs</h3>
              <div className="space-y-2">
                {recentIPOs.slice(0, 8).map((ipo, idx) => (
                  <div
                    key={`${ipo.symbol}-${ipo.date}-recent-${idx}`}
                    className="p-3 rounded-md bg-card border hover-elevate"
                    data-testid={`ipo-recent-${ipo.symbol}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-foreground truncate">
                          {ipo.name}
                        </h4>
                        <a
                          href={`https://finance.yahoo.com/quote/${ipo.symbol}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs hover-elevate cursor-pointer p-1 rounded-sm"
                          onClick={() => onSymbolClick?.(ipo.symbol)}
                          data-testid={`button-symbol-${ipo.symbol}`}
                        >
                          {ipo.symbol}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {ipo.exchange}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(ipo.date), 'MMM dd, yyyy')}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatPrice(ipo.price)}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="h-3 w-3" />
                        {formatShares(ipo.numberOfShares)} shares
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <DollarSign className="h-3 w-3" />
                        {formatMarketCap(ipo.totalSharesValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {upcomingIPOs.length === 0 && recentIPOs.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Rocket className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No IPO data available</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
