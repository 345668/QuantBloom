import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StockQuoteCardProps {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  high52Week?: number;
  low52Week?: number;
}

export default function StockQuoteCard({ 
  symbol, 
  name, 
  price, 
  change, 
  changePercent, 
  volume,
  marketCap,
  pe,
  high52Week,
  low52Week
}: StockQuoteCardProps) {
  const isPositive = change >= 0;
  const changeColor = isPositive ? "text-chart-2" : "text-destructive";

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono">{symbol}</CardTitle>
          <Badge variant="outline" className="text-xs">
            {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {changePercent.toFixed(2)}%
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{name}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="text-2xl font-mono font-bold">
            ${price.toFixed(2)}
          </div>
          <div className={`flex items-center gap-1 ${changeColor} font-mono`}>
            {isPositive ? "+" : ""}{change.toFixed(2)}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Volume:</span>
            <div className="font-mono" data-testid="text-volume">{formatNumber(volume, 0)}</div>
          </div>
          {marketCap && (
            <div>
              <span className="text-muted-foreground">Market Cap:</span>
              <div className="font-mono" data-testid="text-market-cap">{formatNumber(marketCap, 0)}</div>
            </div>
          )}
          {pe && (
            <div>
              <span className="text-muted-foreground">P/E:</span>
              <div className="font-mono" data-testid="text-pe">{pe.toFixed(2)}</div>
            </div>
          )}
          {high52Week && (
            <div>
              <span className="text-muted-foreground">52W High:</span>
              <div className="font-mono" data-testid="text-52w-high">{high52Week.toFixed(2)}</div>
            </div>
          )}
          {low52Week && (
            <div>
              <span className="text-muted-foreground">52W Low:</span>
              <div className="font-mono" data-testid="text-52w-low">{low52Week.toFixed(2)}</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}