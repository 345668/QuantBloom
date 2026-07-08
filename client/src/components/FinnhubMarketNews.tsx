import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Newspaper, ExternalLink, Clock, RefreshCw } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { queryClient } from "@/lib/queryClient";

interface NewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  image: string;
  related: string;
  source: string;
  summary: string;
  url: string;
}

export default function FinnhubMarketNews() {
  const { data: news, isLoading, error, refetch, isFetching } = useQuery<NewsArticle[]>({
    queryKey: ['/api/finnhub/market-news'],
    refetchInterval: 300000
  });

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['/api/finnhub/market-news'] });
    refetch();
  };

  const formatTime = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return 'Recently';
    try {
      const date = new Date(timestamp * 1000);
      if (isNaN(date.getTime())) return 'Recently';
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return 'Recently';
    }
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
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !news || news.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Newspaper className="h-5 w-5" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Unable to load market news</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Newspaper className="h-5 w-5" />
              Market News
            </CardTitle>
            <CardDescription>
              Latest market updates from Finnhub
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={isFetching}
            data-testid="button-refresh-news"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-3">
          {news.slice(0, 15).map((article) => (
            <a
              key={article.id}
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 rounded-md bg-card border hover-elevate group"
              data-testid={`news-article-${article.id}`}
            >
              <div className="flex gap-3">
                {article.image && (
                  <img 
                    src={article.image}
                    alt=""
                    className="w-16 h-16 rounded-md object-cover flex-shrink-0 bg-muted"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <h4 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">
                    {article.headline}
                  </h4>
                  {article.summary && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {article.source}
                    </Badge>
                    {article.category && (
                      <Badge variant="secondary" className="text-xs">
                        {article.category}
                      </Badge>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {formatTime(article.datetime)}
                    </div>
                    <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
