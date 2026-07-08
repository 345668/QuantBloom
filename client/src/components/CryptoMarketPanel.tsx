import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Bitcoin, Loader2, Activity, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatPrice, formatMarketCap, formatVolume, getCryptoName } from "@/lib/utils";

interface CryptoMarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  marketCap: number;
  volume24h: number;
  rank: number;
}

interface TrendingCrypto {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  trendScore: number;
}

interface CryptoMarketPanelProps {
  onCryptoClick?: (symbol: string) => void;
}

export default function CryptoMarketPanel({
  onCryptoClick
}: CryptoMarketPanelProps) {
  const { toast } = useToast();
  
  // Fetch crypto market data
  const { data: marketData = [], isLoading: marketsLoading, error: marketsError } = useQuery<CryptoMarketData[]>({
    queryKey: ["/api/crypto/markets"],
    refetchInterval: 30000 // Refetch every 30 seconds
  });
  
  // Fetch trending crypto data
  const { data: trendingData = [], isLoading: trendingLoading, error: trendingError } = useQuery<TrendingCrypto[]>({
    queryKey: ["/api/crypto/trending"],
    refetchInterval: 60000 // Refetch every 60 seconds
  });

  const handleCryptoClick = (symbol: string) => {
    onCryptoClick?.(symbol);
    console.log("Crypto clicked:", symbol);
  };

  const CryptoCard = ({ crypto, showRank = false, isTrending = false }: { crypto: CryptoMarketData | TrendingCrypto, showRank?: boolean, isTrending?: boolean }) => {
    const isPositive = crypto.change24h >= 0;
    const changeColor = isPositive ? "text-chart-2" : "text-destructive";
    
    return (
      <div
        data-testid={`crypto-item-${crypto.symbol.toLowerCase()}`}
        className="border border-border rounded-md p-3 hover-elevate cursor-pointer"
        onClick={() => handleCryptoClick(crypto.symbol)}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {showRank && 'rank' in crypto && (
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-mono font-bold">
                {crypto.rank}
              </div>
            )}
            {isTrending && (
              <Activity className="w-3 h-3 text-orange-400" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <div className="font-mono font-semibold text-sm">
                  {crypto.symbol}
                </div>
                <Badge variant="default" className="text-xs px-1.5 py-0.5 h-auto">
                  <Bitcoin className="w-2.5 h-2.5 mr-1" />CRYPTO
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {getCryptoName(crypto.symbol)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm font-semibold">
              {formatPrice(crypto.price, crypto.symbol)}
            </div>
            <div className={`text-xs font-mono flex items-center gap-1 ${changeColor}`}>
              {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {crypto.changePercent24h != null ? 
                `${crypto.changePercent24h >= 0 ? "+" : ""}${crypto.changePercent24h.toFixed(2)}%` : 
                "N/A"
              }
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-xs">
          {'marketCap' in crypto ? (
            <>
              <div>
                <span className="text-muted-foreground">Market Cap:</span>
                <div className="font-mono">{formatMarketCap(crypto.marketCap)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Volume 24h:</span>
                <div className="font-mono">{formatVolume(crypto.volume24h, crypto.symbol)}</div>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-muted-foreground">Trend Score:</span>
                <div className="font-mono">{('trendScore' in crypto ? crypto.trendScore : 0).toFixed(1)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Volume 24h:</span>
                <div className="font-mono">{formatVolume(crypto.volume24h, crypto.symbol)}</div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (marketsLoading && trendingLoading) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Bitcoin className="w-4 h-4" />
              Crypto Markets
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }
  
  if (marketsError && trendingError) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Bitcoin className="w-4 h-4" />
              Crypto Markets
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-red-400 text-sm">Failed to load crypto data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Bitcoin className="w-4 h-4" />
            Crypto Markets
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {marketData.length + trendingData.length} assets
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <Tabs defaultValue="markets" className="w-full h-full">
          <TabsList className="grid w-full grid-cols-2 mx-3 mb-2">
            <TabsTrigger 
              data-testid="tab-markets"
              value="markets" 
              className="text-xs"
            >
              <Crown className="w-3 h-3 mr-1" />
              Top Markets
            </TabsTrigger>
            <TabsTrigger 
              data-testid="tab-trending"
              value="trending" 
              className="text-xs"
            >
              <Activity className="w-3 h-3 mr-1" />
              Trending
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="markets" className="h-full overflow-auto p-0 m-0">
            <div className="space-y-2 p-3 pt-0">
              {marketsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                </div>
              ) : marketsError ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Failed to load market data
                </div>
              ) : marketData.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No market data available
                </div>
              ) : (
                marketData.slice(0, 10).map((crypto) => (
                  <CryptoCard 
                    key={crypto.symbol} 
                    crypto={crypto} 
                    showRank={true}
                  />
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="trending" className="h-full overflow-auto p-0 m-0">
            <div className="space-y-2 p-3 pt-0">
              {trendingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
                </div>
              ) : trendingError ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  Failed to load trending data
                </div>
              ) : trendingData.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-8">
                  No trending data available
                </div>
              ) : (
                trendingData.slice(0, 8).map((crypto) => (
                  <CryptoCard 
                    key={crypto.symbol} 
                    crypto={crypto} 
                    isTrending={true}
                  />
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}