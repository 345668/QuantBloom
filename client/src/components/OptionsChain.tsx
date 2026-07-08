import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";

interface OptionContract {
  strike: number;
  callBid: number;
  callAsk: number;
  callVolume: number;
  callOpenInterest: number;
  callImpliedVol: number;
  callDelta: number;
  callGamma: number;
  callTheta: number;
  callVega: number;
  putBid: number;
  putAsk: number;
  putVolume: number;
  putOpenInterest: number;
  putImpliedVol: number;
  putDelta: number;
  putGamma: number;
  putTheta: number;
  putVega: number;
  inTheMoney: boolean;
}

interface OptionsData {
  symbol: string;
  currentPrice: number;
  expiryDates: string[];
  contracts: OptionContract[];
}

interface OptionsChainProps {
  symbol: string;
}

export default function OptionsChain({ symbol }: OptionsChainProps) {
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [showGreeks, setShowGreeks] = useState(false);

  // Construct API URL with query parameters
  const apiUrl = selectedExpiry 
    ? `/api/options/${symbol}?expiry=${selectedExpiry}`
    : `/api/options/${symbol}`;

  // Fetch real options data
  const { data: optionsData, isLoading, error } = useQuery<OptionsData>({
    queryKey: [apiUrl],
    enabled: !!symbol,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refresh every minute
  });

  // Set default expiry when data loads
  useEffect(() => {
    if (optionsData && optionsData.expiryDates && optionsData.expiryDates.length > 0 && !selectedExpiry) {
      setSelectedExpiry(optionsData.expiryDates[0]);
    }
  }, [optionsData, selectedExpiry]);

  // Loading state
  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-orange-500">
            Options Chain - {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading options data...</div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold text-orange-500">
            Options Chain - {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-red-400">Failed to load options data</div>
        </CardContent>
      </Card>
    );
  }

  // Default to empty data if no options data available
  const currentOptionsData = optionsData || {
    currentPrice: 0,
    expiryDates: [],
    contracts: []
  };

  const formatPrice = (price: number) => price.toFixed(2);
  const formatPercent = (value: number) => (value * 100).toFixed(1) + "%";
  const formatGreek = (value: number, decimals = 3) => value.toFixed(decimals);

  const getVolumeColor = (volume: number) => {
    if (volume > 500) return "text-green-500";
    if (volume > 200) return "text-yellow-500";
    return "text-muted-foreground";
  };

  const getImpliedVolColor = (iv: number) => {
    if (iv > 0.25) return "text-red-500";
    if (iv > 0.20) return "text-yellow-500";
    return "text-green-500";
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-orange-500">
            Options Chain - {symbol}
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">
              Current: ${formatPrice(currentOptionsData.currentPrice)}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowGreeks(!showGreeks)}
              data-testid="button-toggle-greeks"
            >
              Greeks
            </Button>
          </div>
        </div>
        
        <div className="flex gap-2">
          {currentOptionsData.expiryDates.map((date) => (
            <Button
              key={date}
              variant={selectedExpiry === date ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedExpiry(date)}
              data-testid={`button-expiry-${date}`}
            >
              {date}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th colSpan={showGreeks ? 6 : 4} className="text-center py-2 bg-green-950/20 text-green-400">
                  CALLS
                </th>
                <th className="py-2 px-2 font-bold">STRIKE</th>
                <th colSpan={showGreeks ? 6 : 4} className="text-center py-2 bg-red-950/20 text-red-400">
                  PUTS
                </th>
              </tr>
              <tr className="border-b border-border text-muted-foreground">
                <th className="px-2 py-1">Bid</th>
                <th className="px-2 py-1">Ask</th>
                <th className="px-2 py-1">Vol</th>
                <th className="px-2 py-1">OI</th>
                {showGreeks && (
                  <>
                    <th className="px-2 py-1">IV</th>
                    <th className="px-2 py-1">Delta</th>
                  </>
                )}
                <th className="px-2 py-1 font-bold">Strike</th>
                <th className="px-2 py-1">Bid</th>
                <th className="px-2 py-1">Ask</th>
                <th className="px-2 py-1">Vol</th>
                <th className="px-2 py-1">OI</th>
                {showGreeks && (
                  <>
                    <th className="px-2 py-1">IV</th>
                    <th className="px-2 py-1">Delta</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {currentOptionsData.contracts.map((contract, index) => (
                <tr
                  key={contract.strike}
                  className={`border-b border-border hover:bg-accent/50 ${
                    Math.abs(contract.strike - currentOptionsData.currentPrice) < 5
                      ? "bg-accent/20"
                      : ""
                  }`}
                  data-testid={`row-option-${contract.strike}`}
                >
                  {/* Call Options */}
                  <td className="px-2 py-1 text-green-400">{formatPrice(contract.callBid)}</td>
                  <td className="px-2 py-1 text-green-400">{formatPrice(contract.callAsk)}</td>
                  <td className={`px-2 py-1 ${getVolumeColor(contract.callVolume)}`}>
                    {contract.callVolume.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {contract.callOpenInterest.toLocaleString()}
                  </td>
                  {showGreeks && (
                    <>
                      <td className={`px-2 py-1 ${getImpliedVolColor(contract.callImpliedVol)}`}>
                        {formatPercent(contract.callImpliedVol)}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {formatGreek(contract.callDelta)}
                      </td>
                    </>
                  )}
                  
                  {/* Strike Price */}
                  <td className="px-2 py-1 text-center font-bold border-x border-border">
                    <div className={`${contract.inTheMoney ? "text-orange-500" : "text-foreground"}`}>
                      ${contract.strike}
                    </div>
                  </td>
                  
                  {/* Put Options */}
                  <td className="px-2 py-1 text-red-400">{formatPrice(contract.putBid)}</td>
                  <td className="px-2 py-1 text-red-400">{formatPrice(contract.putAsk)}</td>
                  <td className={`px-2 py-1 ${getVolumeColor(contract.putVolume)}`}>
                    {contract.putVolume.toLocaleString()}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">
                    {contract.putOpenInterest.toLocaleString()}
                  </td>
                  {showGreeks && (
                    <>
                      <td className={`px-2 py-1 ${getImpliedVolColor(contract.putImpliedVol)}`}>
                        {formatPercent(contract.putImpliedVol)}
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">
                        {formatGreek(contract.putDelta)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-3 border-t border-border">
          <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
            <div>
              <div>Vol = Volume, OI = Open Interest</div>
              <div>IV = Implied Volatility</div>
            </div>
            <div className="text-right">
              <div className="text-orange-500">Near-the-money strikes highlighted</div>
              <div>Current Price: ${formatPrice(currentOptionsData.currentPrice)}</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}