import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, Globe, Calendar, DollarSign, TrendingUp, Users, Phone, ExternalLink } from "lucide-react";

interface CompanyProfileData {
  name: string;
  ticker: string;
  country: string;
  currency: string;
  exchange: string;
  ipo: string;
  marketCapitalization: number;
  shareOutstanding: number;
  logo: string;
  weburl: string;
  phone: string;
  finnhubIndustry: string;
}

interface CompanyProfileProps {
  symbol: string;
}

export default function CompanyProfile({ symbol }: CompanyProfileProps) {
  const { data: profile, isLoading, error } = useQuery<CompanyProfileData>({
    queryKey: [`/api/finnhub/company-profile/${symbol}`],
    enabled: !!symbol,
    refetchInterval: 300000
  });

  const formatMarketCap = (value: number): string => {
    if (!value) return 'N/A';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}B`;
    if (value >= 1000) return `$${(value / 1000).toFixed(2)}M`;
    return `$${value.toFixed(2)}`;
  };

  const formatShares = (value: number): string => {
    if (!value) return 'N/A';
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(0);
  };

  if (!symbol) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Select a symbol to view company profile</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent className="flex-1">
          <div className="space-y-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !profile) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">Unable to load company profile for {symbol}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 flex-shrink-0" />
              <span className="truncate">{profile.name}</span>
            </CardTitle>
            <CardDescription className="mt-1">
              {profile.ticker} • {profile.exchange}
            </CardDescription>
          </div>
          {profile.logo && (
            <img 
              src={profile.logo} 
              alt={`${profile.name} logo`}
              className="w-12 h-12 rounded-md object-contain bg-background"
              data-testid="company-logo"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Market Cap
              </div>
              <p className="text-sm font-semibold" data-testid="market-cap">
                {formatMarketCap(profile.marketCapitalization)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                Shares Out.
              </div>
              <p className="text-sm font-semibold" data-testid="shares-outstanding">
                {formatShares(profile.shareOutstanding)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                IPO Date
              </div>
              <p className="text-sm font-semibold" data-testid="ipo-date">
                {profile.ipo || 'N/A'}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <DollarSign className="h-3 w-3" />
                Currency
              </div>
              <p className="text-sm font-semibold">
                {profile.currency || 'N/A'}
              </p>
            </div>
          </div>

          {profile.finnhubIndustry && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1.5">Industry</p>
              <Badge variant="secondary" className="text-xs" data-testid="industry">
                {profile.finnhubIndustry}
              </Badge>
            </div>
          )}

          {profile.country && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm" data-testid="country">{profile.country}</span>
            </div>
          )}

          {profile.weburl && (
            <div className="pt-2 border-t">
              <a 
                href={profile.weburl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm hover-elevate cursor-pointer p-1 rounded-md"
                data-testid="company-website"
              >
                <Globe className="h-3 w-3" />
                Visit Website
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {profile.phone && (
            <div className="pt-2 border-t">
              <a 
                href={`tel:${profile.phone}`} 
                className="flex items-center gap-1 text-sm hover-elevate cursor-pointer p-1 rounded-md"
                data-testid="company-phone"
              >
                <Phone className="h-3 w-3" />
                {profile.phone}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
