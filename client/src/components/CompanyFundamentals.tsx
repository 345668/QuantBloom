import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building, Search, DollarSign, TrendingUp, Users, PieChart, ChevronDown, Loader2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { CompanyFundamentals } from "@shared/schema";
import { formatPrice, formatMarketCap } from "@/lib/utils";

// Types for S&P 500 search functionality
interface SP500Suggestion {
  symbol: string;
  name: string;
  sector: string;
  label: string;
}

interface SP500SearchResponse {
  suggestions: SP500Suggestion[];
}

interface CompanyFundamentalsPanelProps {
  symbol?: string;
}

export function CompanyFundamentalsPanel({ symbol: defaultSymbol }: CompanyFundamentalsPanelProps) {
  const [symbol, setSymbol] = useState(defaultSymbol || "AAPL");
  const [searchSymbol, setSearchSymbol] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const { data: fundamentals, isLoading, error } = useQuery<CompanyFundamentals>({
    queryKey: [`/api/fundamentals/${symbol}`],
    enabled: !!symbol,
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // S&P 500 suggestions query
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<SP500SearchResponse>({
    queryKey: [`/api/sp500/suggestions`, searchSymbol],
    enabled: searchSymbol.length >= 1,
    staleTime: 60000, // Cache for 1 minute
  });

  const handleSearch = (selectedSymbol?: string) => {
    const symbolToSearch = selectedSymbol || searchSymbol.trim();
    if (symbolToSearch) {
      setSymbol(symbolToSearch.toUpperCase());
      setSearchSymbol("");
      setShowSuggestions(false);
    }
  };

  const handleInputChange = (value: string) => {
    setSearchSymbol(value);
    setShowSuggestions(value.length >= 1);
  };

  const handleSuggestionSelect = (suggestion: SP500Suggestion) => {
    handleSearch(suggestion.symbol);
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatValue = (value: number | undefined, type: 'currency' | 'percentage' | 'number' | 'ratio' = 'number') => {
    if (value === undefined || value === null) return 'N/A';
    
    switch (type) {
      case 'currency':
        return value >= 1e9 ? formatMarketCap(value) : formatPrice(value, symbol);
      case 'percentage':
        return `${value.toFixed(2)}%`;
      case 'ratio':
        return value.toFixed(2);
      default:
        return value.toLocaleString();
    }
  };

  if (isLoading) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Building className="w-4 h-4" />
            Company Fundamentals
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading fundamentals...</div>
        </CardContent>
      </Card>
    );
  }

  if (error || !fundamentals) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Building className="w-4 h-4" />
            Company Fundamentals
          </CardTitle>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                data-testid="input-fundamentals-search"
                placeholder="Search S&P 500 companies..."
                value={searchSymbol}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                onFocus={() => searchSymbol.length >= 1 && setShowSuggestions(true)}
                className="pl-7 h-8 text-xs"
              />
              {suggestionsLoading && (
                <Loader2 className="absolute right-8 top-2.5 h-3 w-3 text-muted-foreground animate-spin" />
              )}
              <ChevronDown className="absolute right-2 top-2.5 h-3 w-3 text-muted-foreground" />
              
              {showSuggestions && suggestions?.suggestions && suggestions.suggestions.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute top-9 left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
                >
                  {suggestions.suggestions.map((suggestion, index) => (
                    <button
                      key={`${suggestion.symbol}-${index}`}
                      data-testid={`suggestion-${suggestion.symbol}`}
                      className="w-full px-3 py-2 text-left hover:bg-accent hover-elevate text-xs flex items-center justify-between border-b border-border/50 last:border-b-0"
                      onClick={() => handleSuggestionSelect(suggestion)}
                    >
                      <div className="flex-1">
                        <div className="font-mono font-medium">{suggestion.symbol}</div>
                        <div className="text-muted-foreground truncate">{suggestion.name}</div>
                      </div>
                      <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                        {suggestion.sector}
                      </Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              data-testid="button-fundamentals-search"
              onClick={() => handleSearch()}
              className="h-8 px-3 text-xs"
            >
              Search
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-2">
              {error ? `Company fundamentals not found for ${symbol}` : 'Enter a symbol to view fundamentals'}
            </div>
            <div className="text-xs text-muted-foreground">
              Search from 500+ S&P 500 companies - try AAPL, GOOGL, MSFT, NVDA
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Building className="w-4 h-4" />
            Company Fundamentals
            <Badge variant="outline" className="text-xs">
              {fundamentals.symbol}
            </Badge>
          </CardTitle>
        </div>
        
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              data-testid="input-fundamentals-search"
              placeholder="Search S&P 500 companies..."
              value={searchSymbol}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              onFocus={() => searchSymbol.length >= 1 && setShowSuggestions(true)}
              className="pl-7 h-8 text-xs"
            />
            {suggestionsLoading && (
              <Loader2 className="absolute right-8 top-2.5 h-3 w-3 text-muted-foreground animate-spin" />
            )}
            <ChevronDown className="absolute right-2 top-2.5 h-3 w-3 text-muted-foreground" />
            
            {showSuggestions && suggestions?.suggestions && suggestions.suggestions.length > 0 && (
              <div
                ref={suggestionsRef}
                className="absolute top-9 left-0 right-0 z-50 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto"
              >
                {suggestions.suggestions.map((suggestion, index) => (
                  <button
                    key={`${suggestion.symbol}-${index}`}
                    data-testid={`suggestion-${suggestion.symbol}`}
                    className="w-full px-3 py-2 text-left hover:bg-accent hover-elevate text-xs flex items-center justify-between border-b border-border/50 last:border-b-0"
                    onClick={() => handleSuggestionSelect(suggestion)}
                  >
                    <div className="flex-1">
                      <div className="font-mono font-medium">{suggestion.symbol}</div>
                      <div className="text-muted-foreground truncate">{suggestion.name}</div>
                    </div>
                    <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                      {suggestion.sector}
                    </Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            data-testid="button-fundamentals-search"
            onClick={() => handleSearch()}
            className="h-8 px-3 text-xs"
          >
            Search
          </Button>
        </div>
        
        <div className="text-sm font-medium mt-2 truncate">
          {fundamentals.name}
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-auto p-3 pt-0">
          <div className="space-y-4">
            {/* Valuation Metrics */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <DollarSign className="w-3 h-3" />
                Valuation
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Market Cap:</span>
                    <span className="font-mono">{formatValue(fundamentals.marketCap, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">P/E Ratio:</span>
                    <span className="font-mono">{formatValue(fundamentals.peRatio, 'ratio')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PEG Ratio:</span>
                    <span className="font-mono">{formatValue(fundamentals.pegRatio, 'ratio')}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Book Value:</span>
                    <span className="font-mono">{formatValue(fundamentals.bookValue, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">EPS:</span>
                    <span className="font-mono">{formatValue(fundamentals.eps, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Div Yield:</span>
                    <span className="font-mono">{formatValue(fundamentals.dividendYield, 'percentage')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Performance */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-3 h-3" />
                Performance
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Revenue:</span>
                    <span className="font-mono">{formatValue(fundamentals.revenue, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Gross Profit:</span>
                    <span className="font-mono">{formatValue(fundamentals.grossProfit, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Net Income:</span>
                    <span className="font-mono">{formatValue(fundamentals.netIncome, 'currency')}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROE:</span>
                    <span className="font-mono">{formatValue(fundamentals.returnOnEquity, 'percentage')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ROA:</span>
                    <span className="font-mono">{formatValue(fundamentals.returnOnAssets, 'percentage')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Profit Margin:</span>
                    <span className="font-mono">{formatValue(fundamentals.profitMargin, 'percentage')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Sheet */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <PieChart className="w-3 h-3" />
                Balance Sheet
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Cash:</span>
                    <span className="font-mono">{formatValue(fundamentals.totalCash, 'currency')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Debt:</span>
                    <span className="font-mono">{formatValue(fundamentals.totalDebt, 'currency')}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shares Out:</span>
                    <span className="font-mono">{formatValue(fundamentals.sharesOutstanding)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Op Margin:</span>
                    <span className="font-mono">{formatValue(fundamentals.operatingMargin, 'percentage')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}