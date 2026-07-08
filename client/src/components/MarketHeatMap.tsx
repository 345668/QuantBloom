import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface HeatMapStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume: number;
  sector: string;
}

interface HeatMapIndex {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
}

interface HeatMapResponse {
  sectors: Record<string, HeatMapStock[]>;
  commodities: HeatMapStock[];
  indices: HeatMapIndex[];
  lastUpdated: string;
}

interface MarketHeatMapProps {
  onSymbolClick?: (symbol: string) => void;
}

export default function MarketHeatMap({ onSymbolClick }: MarketHeatMapProps) {
  const [selectedView, setSelectedView] = useState<"sectors" | "commodities" | "indices">("sectors");
  const [selectedTimeframe, setSelectedTimeframe] = useState("1D");

  // Fetch real heat map data
  const { data: heatMapData, isLoading, error } = useQuery<HeatMapResponse>({
    queryKey: ['/api/heatmap'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 2) return "bg-green-600";
    if (changePercent > 1) return "bg-green-500"; 
    if (changePercent > 0.5) return "bg-green-400";
    if (changePercent > 0) return "bg-green-300";
    if (changePercent > -0.5) return "bg-red-300";
    if (changePercent > -1) return "bg-red-400";
    if (changePercent > -2) return "bg-red-500";
    return "bg-red-600";
  };

  const getTextColor = (changePercent: number) => {
    const absChange = Math.abs(changePercent);
    if (absChange > 1) return "text-white";
    return "text-foreground";
  };

  const getBoxSize = (marketCap: number, maxMarketCap: number) => {
    const ratio = marketCap / maxMarketCap;
    const minSize = 80;
    const maxSize = 200;
    return minSize + (maxSize - minSize) * ratio;
  };

  // Calculate max market cap for sizing
  const getMaxMarketCap = () => {
    if (!heatMapData) return 1;
    const allStocks = [
      ...Object.values(heatMapData.sectors).flat(),
      ...heatMapData.commodities.filter(c => c.marketCap > 0) // Filter out commodities with 0 market cap
    ];
    return Math.max(...allStocks.map(stock => stock.marketCap || 1));
  };

  const maxMarketCap = getMaxMarketCap();

  const formatMarketCap = (marketCap: number) => {
    if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(1)}T`;
    if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(1)}B`;
    if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(1)}M`;
    return `$${marketCap.toFixed(0)}`;
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-orange-500 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Market Heat Map
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {["1D", "5D", "1M"].map((timeframe) => (
                <Button
                  key={timeframe}
                  variant={selectedTimeframe === timeframe ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedTimeframe(timeframe)}
                  data-testid={`button-timeframe-${timeframe}`}
                >
                  {timeframe}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="sectors" data-testid="tab-sectors">Sectors</TabsTrigger>
            <TabsTrigger value="commodities" data-testid="tab-commodities">Commodities</TabsTrigger>
            <TabsTrigger value="indices" data-testid="tab-indices">Indices</TabsTrigger>
          </TabsList>

          {isLoading && (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto mb-2"></div>
                <p className="text-sm text-muted-foreground">Loading market data...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="h-[400px] flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-red-500 mb-2">Failed to load market data</p>
                <p className="text-xs text-muted-foreground">Please try again later</p>
              </div>
            </div>
          )}

          {heatMapData && (
            <>
              <TabsContent value="sectors" className="h-[400px] overflow-auto">
                <div className="space-y-6">
                  {Object.entries(heatMapData.sectors).map(([sectorName, stocks]) => (
                    <div key={sectorName} className="space-y-2">
                      <h3 className="font-semibold text-sm text-muted-foreground">
                        {sectorName}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        {stocks.map((stock) => {
                          const size = getBoxSize(stock.marketCap || 0, maxMarketCap);
                          return (
                            <div
                              key={stock.symbol}
                              className={`
                                ${getChangeColor(stock.changePercent)} 
                                ${getTextColor(stock.changePercent)}
                                cursor-pointer hover:scale-105 transition-transform
                                border border-border rounded-lg p-2 relative
                              `}
                              style={{
                                width: `${size}px`,
                                height: `${Math.min(size * 0.7, 120)}px`,
                              }}
                              onClick={() => onSymbolClick?.(stock.symbol)}
                              data-testid={`heatmap-${stock.symbol}`}
                            >
                              <div className="h-full flex flex-col justify-between">
                                <div>
                                  <div className="font-bold text-sm">{stock.symbol}</div>
                                  <div className="text-xs opacity-90 line-clamp-2">
                                    {stock.name}
                                  </div>
                                </div>
                                <div>
                                  <div className="text-sm font-semibold">
                                    ${stock.price.toFixed(2)}
                                  </div>
                                  <div className="text-xs">
                                    {stock.changePercent > 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
                                  </div>
                                  <div className="text-xs opacity-75">
                                    {formatMarketCap(stock.marketCap || 0)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="commodities" className="h-[400px] overflow-auto">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Commodities & Materials
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {heatMapData.commodities.map((commodity) => (
                      <div
                        key={commodity.symbol}
                        className={`
                          ${getChangeColor(commodity.changePercent)} 
                          ${getTextColor(commodity.changePercent)}
                          cursor-pointer hover:scale-105 transition-transform
                          border border-border rounded-lg p-3
                          w-36 h-28
                        `}
                        onClick={() => onSymbolClick?.(commodity.symbol)}
                        data-testid={`heatmap-commodity-${commodity.symbol}`}
                      >
                        <div className="h-full flex flex-col justify-between">
                          <div>
                            <div className="font-bold">{commodity.symbol}</div>
                            <div className="text-xs opacity-90 line-clamp-2">{commodity.name}</div>
                          </div>
                          <div>
                            <div className="text-sm font-semibold">
                              ${commodity.price.toFixed(commodity.price < 1 ? 4 : 2)}
                            </div>
                            <div className="text-xs">
                              {commodity.changePercent > 0 ? "+" : ""}{commodity.changePercent.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="indices" className="h-[400px] overflow-auto">
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Market Indices
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {heatMapData.indices.map((index) => (
                      <div
                        key={index.symbol}
                        className={`
                          ${getChangeColor(index.changePercent)} 
                          ${getTextColor(index.changePercent)}
                          cursor-pointer hover:scale-105 transition-transform
                          border border-border rounded-lg p-4
                          w-48 h-32
                        `}
                        onClick={() => onSymbolClick?.(index.symbol)}
                        data-testid={`heatmap-index-${index.symbol}`}
                      >
                        <div className="h-full flex flex-col justify-between">
                          <div>
                            <div className="font-bold">{index.symbol}</div>
                            <div className="text-sm opacity-90">{index.name}</div>
                          </div>
                          <div>
                            <div className="font-semibold">
                              {index.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-sm">
                              {index.changePercent > 0 ? "+" : ""}{index.changePercent.toFixed(2)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>
            </>
          )}
        </Tabs>
        
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Positive</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Negative</span>
              </div>
            </div>
            <div>Size represents market cap • Click to view details</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}