import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, TrendingUp, TrendingDown, Search } from "lucide-react";
import { useState } from "react";

interface ScreenerResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  pe?: number;
  dividendYield?: number;
}

interface StockScreenerProps {
  results?: ScreenerResult[];
  onFilter?: (filters: ScreenerFilters) => void;
  onStockClick?: (symbol: string) => void;
}

interface ScreenerFilters {
  minPrice?: number;
  maxPrice?: number;
  minVolume?: number;
  minMarketCap?: number;
  maxPE?: number;
  sector?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export default function StockScreener({ 
  results = [], 
  onFilter, 
  onStockClick 
}: StockScreenerProps) {
  const [filters, setFilters] = useState<ScreenerFilters>({});
  const [showFilters, setShowFilters] = useState(false);

  const updateFilter = (key: keyof ScreenerFilters, value: any) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
  };

  const applyFilters = () => {
    onFilter?.(filters);
    console.log("Filters applied:", filters);
  };

  const clearFilters = () => {
    setFilters({});
    onFilter?.({});
    console.log("Filters cleared");
  };

  const formatNumber = (num: number, decimals = 2) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toFixed(decimals);
  };

  const sortedResults = [...results].sort((a, b) => {
    if (!filters.sortBy) return 0;
    
    const getValue = (item: ScreenerResult, key: string) => {
      switch (key) {
        case "symbol": return item.symbol;
        case "price": return item.price;
        case "change": return item.changePercent;
        case "volume": return item.volume;
        case "marketCap": return item.marketCap;
        case "pe": return item.pe || 0;
        default: return 0;
      }
    };

    const aVal = getValue(a, filters.sortBy);
    const bVal = getValue(b, filters.sortBy);
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return filters.sortOrder === "desc" ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal);
    }
    
    return filters.sortOrder === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Search className="w-4 h-4" />
            Stock Screener
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {results.length} results
            </Badge>
            <Button
              data-testid="button-toggle-filters"
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowFilters(!showFilters);
                console.log(`Filters ${showFilters ? 'hidden' : 'shown'}`);
              }}
              className="h-7 px-2 text-xs"
            >
              <Filter className="w-3 h-3 mr-1" />
              Filters
            </Button>
          </div>
        </div>
        
        {showFilters && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="grid grid-cols-2 gap-2">
              <Input
                data-testid="input-min-price"
                type="number"
                placeholder="Min Price"
                value={filters.minPrice || ""}
                onChange={(e) => updateFilter("minPrice", e.target.value ? parseFloat(e.target.value) : undefined)}
                className="h-7 text-xs"
              />
              <Input
                data-testid="input-max-price"
                type="number"
                placeholder="Max Price"
                value={filters.maxPrice || ""}
                onChange={(e) => updateFilter("maxPrice", e.target.value ? parseFloat(e.target.value) : undefined)}
                className="h-7 text-xs"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <Select onValueChange={(value) => updateFilter("sortBy", value)}>
                <SelectTrigger data-testid="select-sort-by" className="h-7 text-xs">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="symbol">Symbol</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="change">Change %</SelectItem>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="marketCap">Market Cap</SelectItem>
                  <SelectItem value="pe">P/E Ratio</SelectItem>
                </SelectContent>
              </Select>
              
              <Select onValueChange={(value) => updateFilter("sortOrder", value as "asc" | "desc")}>
                <SelectTrigger data-testid="select-sort-order" className="h-7 text-xs">
                  <SelectValue placeholder="Order" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                data-testid="button-apply-filters"
                size="sm"
                onClick={applyFilters}
                className="h-7 px-3 text-xs flex-1"
              >
                Apply
              </Button>
              <Button
                data-testid="button-clear-filters"
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                className="h-7 px-3 text-xs flex-1"
              >
                Clear
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-auto p-0">
        <div className="space-y-1 p-3 pt-0">
          {sortedResults.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No stocks match current filters
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header */}
              <div className="grid grid-cols-6 gap-2 text-xs text-muted-foreground font-mono py-1 border-b border-border">
                <div>SYMBOL</div>
                <div className="text-right">PRICE</div>
                <div className="text-right">CHANGE</div>
                <div className="text-right">VOLUME</div>
                <div className="text-right">MKT CAP</div>
                <div className="text-right">P/E</div>
              </div>
              
              {/* Results */}
              {sortedResults.map((stock) => {
                const isPositive = stock.change >= 0;
                const changeColor = isPositive ? "text-chart-2" : "text-destructive";
                
                return (
                  <div
                    key={stock.symbol}
                    data-testid={`screener-result-${stock.symbol.toLowerCase()}`}
                    className="grid grid-cols-6 gap-2 text-xs py-2 hover-elevate cursor-pointer rounded border border-transparent hover:border-border"
                    onClick={() => {
                      onStockClick?.(stock.symbol);
                      console.log("Stock clicked from screener:", stock.symbol);
                    }}
                  >
                    <div className="font-mono font-semibold">
                      {stock.symbol}
                    </div>
                    <div className="text-right font-mono">
                      ${stock.price.toFixed(2)}
                    </div>
                    <div className={`text-right font-mono flex items-center justify-end gap-1 ${changeColor}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stock.changePercent.toFixed(2)}%
                    </div>
                    <div className="text-right font-mono text-muted-foreground">
                      {formatNumber(stock.volume, 0)}
                    </div>
                    <div className="text-right font-mono text-muted-foreground">
                      {formatNumber(stock.marketCap, 0)}
                    </div>
                    <div className="text-right font-mono text-muted-foreground">
                      {stock.pe ? stock.pe.toFixed(1) : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}