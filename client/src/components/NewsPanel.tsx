import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Newspaper, Search, TrendingUp, TrendingDown, Minus, ExternalLink, Clock } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { NewsItem } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface NewsPanelProps {
  selectedSymbol?: string;
}

export default function NewsPanel({ selectedSymbol }: NewsPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<"all" | "bullish" | "bearish" | "neutral">("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Fetch general news
  const { data: generalNews = [], isLoading: generalLoading } = useQuery<NewsItem[]>({
    queryKey: ['/api/news'],
    queryFn: async () => {
      const response = await fetch('/api/news?limit=50');
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch symbol-specific news if symbol is selected
  const { data: symbolNews = [], isLoading: symbolLoading } = useQuery<NewsItem[]>({
    queryKey: ['/api/news', 'symbol', selectedSymbol],
    queryFn: async () => {
      const url = new URL('/api/news', window.location.origin);
      if (selectedSymbol) {
        url.searchParams.set('symbols', selectedSymbol);
      }
      url.searchParams.set('limit', '20');
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    },
    enabled: !!selectedSymbol,
    refetchInterval: 60000,
  });

  const allNews: NewsItem[] = selectedSymbol 
    ? [...symbolNews, ...generalNews].slice(0, 50)
    : generalNews;

  // Filter news based on search and filters
  const filteredNews = allNews.filter(item => {
    const matchesSearch = !searchTerm || 
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.source.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSentiment = sentimentFilter === "all" || item.sentimentLabel === sentimentFilter;

    const matchesSource = sourceFilter === "all" || item.source === sourceFilter;

    return matchesSearch && matchesSentiment && matchesSource;
  });

  // Get unique sources for filter
  const sources = Array.from(new Set(allNews.map(item => item.source))).sort();

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case 'bullish': return <TrendingUp className="w-3 h-3 text-green-400" />;
      case 'bearish': return <TrendingDown className="w-3 h-3 text-red-400" />;
      default: return <Minus className="w-3 h-3 text-yellow-400" />;
    }
  };

  const getSentimentColor = (sentiment?: string) => {
    switch (sentiment) {
      case 'bullish': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'bearish': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  const isLoading = generalLoading || symbolLoading;

  if (isLoading) {
    return (
      <Card className="h-96 flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Financial News
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading news...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-96 flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-mono flex items-center gap-2">
            <Newspaper className="w-4 h-4" />
            Financial News
            {selectedSymbol && (
              <Badge variant="outline" className="text-xs">
                {selectedSymbol}
              </Badge>
            )}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {filteredNews.length} articles
          </Badge>
        </div>
        
        {/* Search and Filters */}
        <div className="flex gap-2 mt-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
            <Input
              data-testid="input-news-search"
              placeholder="Search news..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
          
          <Select value={sentimentFilter} onValueChange={(value: any) => setSentimentFilter(value)}>
            <SelectTrigger data-testid="select-sentiment-filter" className="w-24 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="bullish">Bullish</SelectItem>
              <SelectItem value="bearish">Bearish</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger data-testid="select-source-filter" className="w-28 h-8 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map(source => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="h-full overflow-auto p-3 pt-0">
          <div className="space-y-3">
            {filteredNews.length > 0 ? (
              filteredNews.map((item) => (
                <div
                  key={item.id}
                  data-testid={`news-item-${item.id}`}
                  className="border rounded-md p-3 hover-elevate cursor-pointer transition-colors"
                  onClick={() => window.open(item.url, '_blank')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {item.sentimentLabel && (
                          <Badge 
                            variant="outline" 
                            className={`text-xs px-1 py-0 h-5 ${getSentimentColor(item.sentimentLabel)}`}
                          >
                            {getSentimentIcon(item.sentimentLabel)}
                            <span className="ml-1 capitalize">{item.sentimentLabel}</span>
                          </Badge>
                        )}
                        {item.symbol && (
                          <Badge variant="outline" className="text-xs">
                            {item.symbol}
                          </Badge>
                        )}
                      </div>
                      
                      <h4 className="font-medium text-sm leading-tight mb-1 line-clamp-2">
                        {item.title}
                      </h4>
                      
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {item.summary}
                      </p>
                      
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium">{item.source}</span>
                        <span>{formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    
                    <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-1" />
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-sm text-muted-foreground py-8">
                {searchTerm || sentimentFilter !== "all" || sourceFilter !== "all" 
                  ? "No news found matching your filters" 
                  : "No news available"}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}