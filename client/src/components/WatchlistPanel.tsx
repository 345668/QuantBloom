import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, X, Star, TrendingUp, TrendingDown, Loader2, Bitcoin, DollarSign, Bell, BarChart3, ArrowUpDown, MoreVertical } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isCrypto, formatPrice, formatVolume, getCryptoName } from "@/lib/utils";
import TradingDialog from "./TradingDialog";

interface WatchlistItem {
  id: string;
  symbol: string;
  name: string;
  price?: number;
  change?: number;
  changePercent?: number;
  volume?: number;
  marketCap?: number;
  addedAt: Date;
}

interface WatchlistPanelProps {
  onSymbolClick?: (symbol: string) => void;
  onCreateAlert?: (symbol: string) => void;
}

type SortOption = 'symbol' | 'price' | 'change' | 'volume';
type FilterOption = 'all' | 'stocks' | 'crypto';

export default function WatchlistPanel({ 
  onSymbolClick,
  onCreateAlert
}: WatchlistPanelProps) {
  const [newSymbol, setNewSymbol] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>('symbol');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [tradingSymbol, setTradingSymbol] = useState<{ symbol: string; price: number } | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  // Fetch watchlist data
  const { data: watchlist = [], isLoading, error } = useQuery<WatchlistItem[]>({
    queryKey: ["/api/watchlist"],
    refetchInterval: 30000 // Refetch every 30 seconds
  });
  
  // Add to watchlist mutation
  const addToWatchlistMutation = useMutation({
    mutationFn: async (symbol: string) => {
      return apiRequest("POST", "/api/watchlist", { symbol: symbol.toUpperCase() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      setNewSymbol("");
      toast({
        title: "Success",
        description: `Added ${newSymbol.toUpperCase()} to watchlist`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add symbol to watchlist",
        variant: "destructive"
      });
    }
  });
  
  // Remove from watchlist mutation
  const removeFromWatchlistMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/watchlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] });
      toast({
        title: "Success",
        description: "Removed from watchlist"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove from watchlist",
        variant: "destructive"
      });
    }
  });

  const handleAddSymbol = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSymbol.trim() && !addToWatchlistMutation.isPending) {
      addToWatchlistMutation.mutate(newSymbol.trim());
    }
  };
  
  const handleRemoveSymbol = (id: string, symbol: string) => {
    removeFromWatchlistMutation.mutate(id);
  };

  const handleCreateAlert = (symbol: string) => {
    onCreateAlert?.(symbol);
  };

  // Sort and filter watchlist
  const sortedAndFilteredWatchlist = watchlist
    .filter(item => {
      if (filterBy === 'all') return true;
      if (filterBy === 'crypto') return isCrypto(item.symbol);
      if (filterBy === 'stocks') return !isCrypto(item.symbol);
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'symbol':
          return a.symbol.localeCompare(b.symbol);
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'change':
          return (b.changePercent || 0) - (a.changePercent || 0);
        case 'volume':
          return (b.volume || 0) - (a.volume || 0);
        default:
          return 0;
      }
    });


  if (isLoading) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-mono flex items-center gap-2">
              <Star className="w-4 h-4" />
              Watchlist
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
              <Star className="w-4 h-4" />
              Watchlist
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-red-400 text-sm">Failed to load watchlist</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Star className="w-4 h-4" />
            Watchlist
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {sortedAndFilteredWatchlist.length}/{watchlist.length} symbols
            </Badge>
          </div>
        </div>
        
        <form onSubmit={handleAddSymbol} className="flex gap-2 mb-3">
          <Input
            data-testid="input-add-symbol"
            type="text"
            placeholder="Add symbol (BTC, ETH, AAPL...)"
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            className="flex-1 h-8 bg-input border-border text-sm font-mono uppercase"
          />
          <Button 
            data-testid="button-add-symbol"
            type="submit" 
            size="sm" 
            className="h-8 px-2"
            disabled={addToWatchlistMutation.isPending || !newSymbol.trim()}
          >
            {addToWatchlistMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </Button>
        </form>

        {/* Sort and Filter Controls */}
        <div className="flex gap-2 items-center">
          <Select value={filterBy} onValueChange={(value) => setFilterBy(value as FilterOption)}>
            <SelectTrigger className="w-24 h-7 text-xs" data-testid="select-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="stocks">Stocks</SelectItem>
              <SelectItem value="crypto">Crypto</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-20 h-7 text-xs" data-testid="select-sort">
              <ArrowUpDown className="w-3 h-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="symbol">Symbol</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="change">Change %</SelectItem>
              <SelectItem value="volume">Volume</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="space-y-1 p-3 pt-0">
          {sortedAndFilteredWatchlist.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              {watchlist.length === 0 ? "No symbols in watchlist" : "No symbols match current filter"}
            </div>
          ) : (
            sortedAndFilteredWatchlist.map((item) => {
              const isPositive = (item.change || 0) >= 0;
              const changeColor = isPositive ? "text-chart-2" : "text-destructive";
              const isCryptoSymbol = isCrypto(item.symbol);
              const displayName = isCryptoSymbol ? getCryptoName(item.symbol) : item.name;
              
              return (
                <div
                  key={item.symbol}
                  data-testid={`watchlist-item-${item.symbol.toLowerCase()}`}
                  className="group flex items-center justify-between p-2 rounded hover-elevate cursor-pointer border border-transparent hover:border-border"
                  onClick={() => {
                    onSymbolClick?.(item.symbol);
                    console.log("Symbol clicked:", item.symbol);
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-semibold text-sm">
                          {item.symbol}
                        </span>
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
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            data-testid={`button-actions-${item.symbol.toLowerCase()}`}
                            size="sm"
                            variant="ghost"
                            onClick={(e) => e.stopPropagation()}
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                          >
                            <MoreVertical className="w-3 h-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              setTradingSymbol({ symbol: item.symbol, price: item.price || 0 });
                            }}
                            className="cursor-pointer"
                            data-testid={`menu-trade-${item.symbol.toLowerCase()}`}
                          >
                            <DollarSign className="w-3 h-3 mr-2" />
                            Trade
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateAlert(item.symbol);
                            }}
                            className="cursor-pointer"
                            data-testid={`menu-create-alert-${item.symbol.toLowerCase()}`}
                          >
                            <Bell className="w-3 h-3 mr-2" />
                            Create Alert
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              onSymbolClick?.(item.symbol);
                            }}
                            className="cursor-pointer"
                            data-testid={`menu-view-chart-${item.symbol.toLowerCase()}`}
                          >
                            <BarChart3 className="w-3 h-3 mr-2" />
                            View Chart
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveSymbol(item.id, item.symbol);
                            }}
                            className="cursor-pointer text-destructive focus:text-destructive"
                            data-testid={`menu-remove-${item.symbol.toLowerCase()}`}
                            disabled={removeFromWatchlistMutation.isPending}
                          >
                            <X className="w-3 h-3 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {displayName}
                    </div>
                    <div className="flex items-center justify-between text-xs mt-1">
                      {item.price ? (
                        <>
                          <span className="font-mono font-semibold">
                            {formatPrice(item.price, item.symbol)}
                          </span>
                          <div className={`flex items-center gap-1 ${changeColor} font-mono`}>
                            {isPositive ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            <span>
                              {isPositive ? "+" : ""}{(item.changePercent || 0).toFixed(2)}%
                            </span>
                          </div>
                        </>
                      ) : (
                        <span className="font-mono text-muted-foreground text-xs">Loading...</span>
                      )}
                    </div>
                    {item.volume && (
                      <div className="text-xs text-muted-foreground font-mono">
                        Vol: {formatVolume(item.volume, item.symbol)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
      
      <TradingDialog 
        open={!!tradingSymbol}
        onOpenChange={(open) => !open && setTradingSymbol(null)}
        symbol={tradingSymbol?.symbol || ""}
        currentPrice={tradingSymbol?.price || 0}
      />
    </Card>
  );
}