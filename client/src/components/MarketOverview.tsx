import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface MarketIndex {
  name: string;
  symbol: string;
  value: number;
  change: number;
  changePercent: number;
}

interface MarketOverviewProps {
  indices?: MarketIndex[];
  marketStatus?: "OPEN" | "CLOSED" | "PRE_MARKET" | "AFTER_HOURS";
}

export default function MarketOverview({ 
  indices = [], 
  marketStatus = "OPEN" 
}: MarketOverviewProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN": return "text-chart-2";
      case "CLOSED": return "text-muted-foreground";
      case "PRE_MARKET": return "text-primary";
      case "AFTER_HOURS": return "text-chart-4";
      default: return "text-muted-foreground";
    }
  };

  const formatNumber = (num: number, decimals = 2) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);
  };

  return (
    <Card className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Market Overview
          </CardTitle>
          <Badge 
            variant="outline" 
            className={`text-xs ${getStatusColor(marketStatus)}`}
          >
            <span className="w-2 h-2 bg-current rounded-full mr-1"></span>
            {marketStatus.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {indices.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            No market data available
          </div>
        ) : (
          <div className="grid gap-3">
            {indices.map((index) => {
              const isPositive = index.change >= 0;
              const changeColor = isPositive ? "text-chart-2" : "text-destructive";
              
              return (
                <div
                  key={index.symbol}
                  data-testid={`market-index-${index.symbol.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  className="flex items-center justify-between p-3 border border-border rounded-md hover-elevate"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-mono font-semibold text-sm">
                        {index.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {index.name}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="font-mono font-semibold">
                      {formatNumber(index.value)}
                    </div>
                    <div className={`flex items-center gap-1 text-sm ${changeColor} font-mono`}>
                      {isPositive ? (
                        <TrendingUp className="w-3 h-3" />
                      ) : (
                        <TrendingDown className="w-3 h-3" />
                      )}
                      <span>
                        {isPositive ? "+" : ""}{formatNumber(index.change)} 
                        ({isPositive ? "+" : ""}{index.changePercent.toFixed(2)}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground font-mono">
          <span>Last Updated: {new Date().toLocaleTimeString()}</span>
          <span>Real-time data</span>
        </div>
      </CardContent>
    </Card>
  );
}