import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Loader2, Bitcoin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isCrypto, formatPrice, getCryptoName } from "@/lib/utils";
import { useState } from "react";
import TradingDialog from "./TradingDialog";

interface PortfolioPosition {
  id: string;
  symbol: string;
  name: string;
  quantity: string;
  avgPrice: string;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  addedAt: Date;
}

interface PortfolioData {
  positions: PortfolioPosition[];
  summary: {
    totalValue: number;
    totalCost: number;
    totalPnL: number;
    totalPnLPercent: number;
  };
}

interface PortfolioPanelProps {
  onPositionClick?: (symbol: string) => void;
}

export default function PortfolioPanel({
  onPositionClick
}: PortfolioPanelProps) {
  const { toast } = useToast();
  const [tradingPosition, setTradingPosition] = useState<{ symbol: string; price: number; quantity: number } | null>(null);
  
  // Fetch portfolio data
  const { data: portfolioData, isLoading, error } = useQuery<PortfolioData>({
    queryKey: ["/api/portfolio"],
    refetchInterval: 30000 // Refetch every 30 seconds
  });
  
  const positions = portfolioData?.positions || [];
  const { totalValue = 0, totalPnL = 0, totalPnLPercent = 0 } = portfolioData?.summary || {};
  const isPositiveTotal = totalPnL >= 0;
  const totalPnLColor = isPositiveTotal ? "text-chart-2" : "text-destructive";

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatQuantity = (quantity: number, symbol: string) => {
    const isCryptoSymbol = isCrypto(symbol);
    if (isCryptoSymbol) {
      // Crypto quantities can be fractional and need more precision
      return quantity.toFixed(8).replace(/\.?0+$/, '');
    }
    // Stocks are typically whole shares or small fractions
    return quantity.toFixed(4).replace(/\.?0+$/, '');
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  if (isLoading) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Portfolio
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Portfolio
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-red-400 text-sm">Failed to load portfolio</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Portfolio
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {positions.length} positions
          </Badge>
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Total Value</span>
            <div className="font-mono font-bold" data-testid="text-total-value">
              {formatCurrency(totalValue)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">Total P&L</span>
            <div className={`font-mono font-bold ${totalPnLColor}`} data-testid="text-total-pnl">
              {totalPnL >= 0 ? "+" : ""}{formatCurrency(totalPnL)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground text-xs">P&L %</span>
            <div className={`font-mono font-bold flex items-center gap-1 ${totalPnLColor}`} data-testid="text-total-pnl-percent">
              {isPositiveTotal ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {totalPnLPercent >= 0 ? "+" : ""}{totalPnLPercent.toFixed(2)}%
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="space-y-2 p-3 pt-0">
          {positions.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No positions in portfolio
            </div>
          ) : (
            positions.map((position) => {
              const isPositive = position.unrealizedPnL >= 0;
              const pnlColor = isPositive ? "text-chart-2" : "text-destructive";
              const isCryptoSymbol = isCrypto(position.symbol);
              const displayName = isCryptoSymbol ? getCryptoName(position.symbol) : position.name;
              
              return (
                <div
                  key={position.symbol}
                  data-testid={`position-${position.symbol.toLowerCase()}`}
                  className="border border-border rounded-md p-3 hover-elevate cursor-pointer"
                  onClick={() => {
                    onPositionClick?.(position.symbol);
                    console.log("Position clicked:", position.symbol);
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="font-mono font-semibold text-sm">
                          {position.symbol}
                        </div>
                        <Badge 
                          variant={isCryptoSymbol ? "default" : "secondary"} 
                          className="text-xs px-1.5 py-0.5 h-auto"
                        >
                          {isCryptoSymbol ? (
                            <><Bitcoin className="w-2.5 h-2.5 mr-1" />CRYPTO</>
                          ) : (
                            <><DollarSign className="w-2.5 h-2.5 mr-1" />STOCK</>
                          )}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {displayName}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold">
                        {formatPrice(position.currentPrice, position.symbol)}
                      </div>
                      <div className={`text-xs font-mono ${pnlColor}`}>
                        {position.unrealizedPnLPercent >= 0 ? "+" : ""}{position.unrealizedPnLPercent.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                    <div>
                      <span className="text-muted-foreground">Qty:</span>
                      <div className="font-mono">{formatQuantity(parseFloat(position.quantity), position.symbol)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Avg Cost:</span>
                      <div className="font-mono">{formatPrice(parseFloat(position.avgPrice), position.symbol)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Market Value:</span>
                      <div className="font-mono">{formatCurrency(position.marketValue)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unrealized P&L:</span>
                      <div className={`font-mono ${pnlColor}`}>
                        {position.unrealizedPnL >= 0 ? "+" : ""}{formatCurrency(position.unrealizedPnL)}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTradingPosition({
                        symbol: position.symbol,
                        price: position.currentPrice,
                        quantity: parseFloat(position.quantity)
                      });
                    }}
                    data-testid={`button-trade-${position.symbol.toLowerCase()}`}
                  >
                    <DollarSign className="w-3 h-3 mr-1" />
                    Trade
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
      
      <TradingDialog 
        open={!!tradingPosition}
        onOpenChange={(open) => !open && setTradingPosition(null)}
        symbol={tradingPosition?.symbol || ""}
        currentPrice={tradingPosition?.price || 0}
        availableQuantity={tradingPosition?.quantity || 0}
      />
    </Card>
  );
}