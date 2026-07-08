import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Activity, Target } from "lucide-react";
import { format } from "date-fns";
import { calculateAllIndicators, type EnhancedChartData } from "@/lib/technicalIndicators";
import { isCrypto, getApiEndpoint, formatPrice } from "@/lib/utils";

interface TechnicalAnalysisProps {
  symbol: string;
}

export default function TechnicalAnalysis({ symbol }: TechnicalAnalysisProps) {
  const [interval, setInterval] = useState<"1D" | "5D" | "1M" | "3M" | "1Y">("1D");
  const [activeTab, setActiveTab] = useState("overview");
  const [indicators, setIndicators] = useState({
    sma20: true,
    sma50: true,
    ema12: false,
    ema26: false,
    bollinger: true,
    rsi: true,
    macd: true,
    volume: true
  });

  const isCryptoSymbol = isCrypto(symbol);

  // Fetch chart data and calculate indicators
  const { data: enhancedData = [], isLoading, error } = useQuery<EnhancedChartData[]>({
    queryKey: ["technical-analysis", symbol, interval],
    queryFn: async () => {
      const endpoint = getApiEndpoint(symbol, 'chart');
      const response = await fetch(`${endpoint}?interval=${interval}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      const rawData = await response.json();
      const chartData = rawData.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
      return calculateAllIndicators(chartData);
    },
    enabled: !!symbol,
    refetchInterval: 30000
  });

  const formatTimestamp = (timestamp: Date) => {
    return format(timestamp, interval === '1D' ? 'HH:mm' : 'MMM dd');
  };

  const chartData = enhancedData.map(item => ({
    ...item,
    formattedTime: formatTimestamp(item.timestamp)
  }));

  const getCurrentSignals = () => {
    if (chartData.length === 0) return [];
    
    const latest = chartData[chartData.length - 1];
    const previous = chartData[chartData.length - 2];
    const signals = [];

    // RSI signals
    if (latest.rsi != null && previous?.rsi != null && 
        Number.isFinite(latest.rsi) && Number.isFinite(previous.rsi)) {
      if (latest.rsi > 70) {
        signals.push({ type: "SELL", indicator: "RSI", value: latest.rsi.toFixed(1), message: "Overbought" });
      } else if (latest.rsi < 30) {
        signals.push({ type: "BUY", indicator: "RSI", value: latest.rsi.toFixed(1), message: "Oversold" });
      }
    }

    // MACD signals
    if (latest.macd != null && latest.macdSignal != null && 
        previous?.macd != null && previous?.macdSignal != null &&
        Number.isFinite(latest.macd) && Number.isFinite(latest.macdSignal) && 
        Number.isFinite(previous.macd) && Number.isFinite(previous.macdSignal)) {
      if (previous.macd <= previous.macdSignal && latest.macd > latest.macdSignal) {
        signals.push({ type: "BUY", indicator: "MACD", value: latest.macd.toFixed(3), message: "Bullish crossover" });
      } else if (previous.macd >= previous.macdSignal && latest.macd < latest.macdSignal) {
        signals.push({ type: "SELL", indicator: "MACD", value: latest.macd.toFixed(3), message: "Bearish crossover" });
      }
    }

    // Moving Average signals
    if (latest.close != null && latest.sma20 != null && latest.sma50 != null &&
        Number.isFinite(latest.close) && Number.isFinite(latest.sma20) && Number.isFinite(latest.sma50)) {
      if (latest.close > latest.sma20 && latest.sma20 > latest.sma50) {
        signals.push({ type: "BUY", indicator: "MA", value: latest.close.toFixed(2), message: "Above MA20 & MA50" });
      } else if (latest.close < latest.sma20 && latest.sma20 < latest.sma50) {
        signals.push({ type: "SELL", indicator: "MA", value: latest.close.toFixed(2), message: "Below MA20 & MA50" });
      }
    }

    // Bollinger Bands signals
    if (latest.close != null && latest.upperBB != null && latest.lowerBB != null &&
        Number.isFinite(latest.close) && Number.isFinite(latest.upperBB) && Number.isFinite(latest.lowerBB)) {
      if (latest.close > latest.upperBB) {
        signals.push({ type: "SELL", indicator: "BB", value: latest.close.toFixed(2), message: "Above upper band" });
      } else if (latest.close < latest.lowerBB) {
        signals.push({ type: "BUY", indicator: "BB", value: latest.close.toFixed(2), message: "Below lower band" });
      }
    }

    return signals;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-popover-border p-3 rounded-md shadow-lg">
          <p className="text-sm font-mono text-popover-foreground mb-2">{label}</p>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Close:</span>
              <span>{formatPrice(data.close || 0, symbol)}</span>
            </div>
            {indicators.sma20 && data.sma20 && (
              <div className="flex justify-between gap-4">
                <span className="text-blue-400">SMA 20:</span>
                <span>{formatPrice(data.sma20, symbol)}</span>
              </div>
            )}
            {indicators.sma50 && data.sma50 && (
              <div className="flex justify-between gap-4">
                <span className="text-purple-400">SMA 50:</span>
                <span>{formatPrice(data.sma50, symbol)}</span>
              </div>
            )}
            {indicators.rsi && data.rsi && (
              <div className="flex justify-between gap-4">
                <span className="text-orange-400">RSI:</span>
                <span>{data.rsi.toFixed(1)}</span>
              </div>
            )}
            {indicators.macd && data.macd && (
              <div className="flex justify-between gap-4">
                <span className="text-green-400">MACD:</span>
                <span>{data.macd.toFixed(3)}</span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  const signals = getCurrentSignals();

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-orange-500 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Technical Analysis - {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </CardContent>
      </Card>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-lg font-bold text-orange-500 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Technical Analysis - {symbol}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-red-400 text-sm">Failed to load technical analysis data</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-orange-500 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Technical Analysis - {symbol}
          </CardTitle>
          <div className="flex gap-2">
            {["1D", "5D", "1M", "3M", "1Y"].map((int) => (
              <Button
                key={int}
                size="sm"
                variant={interval === int ? "default" : "outline"}
                onClick={() => setInterval(int as any)}
                data-testid={`button-ta-interval-${int.toLowerCase()}`}
              >
                {int}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="indicators" data-testid="tab-indicators">Indicators</TabsTrigger>
            <TabsTrigger value="signals" data-testid="tab-signals">Signals</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="p-4">
            <div className="space-y-4">
              {/* Main price chart with indicators */}
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="formattedTime" 
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      domain={['dataMin - 1', 'dataMax + 1']}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {/* Price line */}
                    <Line
                      type="monotone"
                      dataKey="close"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                    />
                    
                    {/* Moving averages */}
                    {indicators.sma20 && (
                      <Line
                        type="monotone"
                        dataKey="sma20"
                        stroke="#3b82f6"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="5 5"
                        data-testid="chart-sma20"
                      />
                    )}
                    {indicators.sma50 && (
                      <Line
                        type="monotone"
                        dataKey="sma50"
                        stroke="#a855f7"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="5 5"
                        data-testid="chart-sma50"
                      />
                    )}
                    {/* EMA indicators */}
                    {indicators.ema12 && (
                      <Line
                        type="monotone"
                        dataKey="ema12"
                        stroke="#10b981"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="3 3"
                        data-testid="chart-ema12"
                      />
                    )}
                    {indicators.ema26 && (
                      <Line
                        type="monotone"
                        dataKey="ema26"
                        stroke="#f59e0b"
                        strokeWidth={1}
                        dot={false}
                        strokeDasharray="3 3"
                        data-testid="chart-ema26"
                      />
                    )}
                    
                    {/* Bollinger Bands */}
                    {indicators.bollinger && (
                      <>
                        <Line
                          type="monotone"
                          dataKey="upperBB"
                          stroke="#ef4444"
                          strokeWidth={1}
                          dot={false}
                          strokeDasharray="2 2"
                          opacity={0.7}
                        />
                        <Line
                          type="monotone"
                          dataKey="lowerBB"
                          stroke="#ef4444"
                          strokeWidth={1}
                          dot={false}
                          strokeDasharray="2 2"
                          opacity={0.7}
                        />
                      </>
                    )}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* RSI chart */}
              {indicators.rsi && (
                <div className="h-24">
                  <div className="text-xs text-muted-foreground mb-1">RSI (14)</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="formattedTime" 
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis 
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                        domain={[0, 100]}
                      />
                      <Line
                        type="monotone"
                        dataKey="rsi"
                        stroke="#f97316"
                        strokeWidth={1}
                        dot={false}
                      />
                      <ReferenceLine y={70} stroke="#ef4444" strokeDasharray="2 2" />
                      <ReferenceLine y={30} stroke="#22c55e" strokeDasharray="2 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* MACD chart */}
              {indicators.macd && chartData.some(d => Number.isFinite(d.macd)) && (
                <div className="h-24">
                  <div className="text-xs text-muted-foreground mb-1">MACD</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="formattedTime" 
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis 
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Line
                        type="monotone"
                        dataKey="macd"
                        stroke="#10b981"
                        strokeWidth={1}
                        dot={false}
                        data-testid="chart-macd-line"
                      />
                      <Line
                        type="monotone"
                        dataKey="macdSignal"
                        stroke="#ef4444"
                        strokeWidth={1}
                        dot={false}
                        data-testid="chart-macd-signal"
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="2 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Volume chart */}
              {indicators.volume && (
                <div className="h-20">
                  <div className="text-xs text-muted-foreground mb-1">Volume</div>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="formattedTime" 
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <YAxis 
                        tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }}
                      />
                      <Bar 
                        dataKey="volume" 
                        fill="hsl(var(--muted))" 
                        opacity={0.6}
                        data-testid="chart-volume-bars"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="indicators" className="p-4 relative z-10" style={{ pointerEvents: 'auto' }}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="font-semibold text-sm">Moving Averages</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SMA 20</span>
                      <Switch
                        checked={indicators.sma20}
                        onCheckedChange={(checked) => 
                          setIndicators(prev => ({ ...prev, sma20: checked }))
                        }
                        data-testid="switch-sma20"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">SMA 50</span>
                      <Switch
                        checked={indicators.sma50}
                        onCheckedChange={(checked) => 
                          setIndicators(prev => ({ ...prev, sma50: checked }))
                        }
                        data-testid="switch-sma50"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">EMA 12</span>
                      <Switch
                        checked={indicators.ema12}
                        onCheckedChange={(checked) => 
                          setIndicators(prev => ({ ...prev, ema12: checked }))
                        }
                        data-testid="switch-ema12"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-semibold text-sm">Oscillators</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">RSI</span>
                      <Switch
                        checked={indicators.rsi}
                        onCheckedChange={(checked) => 
                          setIndicators(prev => ({ ...prev, rsi: checked }))
                        }
                        data-testid="switch-rsi"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">MACD</span>
                      <Switch
                        checked={indicators.macd}
                        onCheckedChange={(checked) => 
                          setIndicators(prev => ({ ...prev, macd: checked }))
                        }
                        data-testid="switch-macd"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Bollinger Bands</span>
                      <Switch
                        checked={indicators.bollinger}
                        onCheckedChange={(checked) => 
                          setIndicators(prev => ({ ...prev, bollinger: checked }))
                        }
                        data-testid="switch-bollinger"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signals" className="p-4" data-testid="tab-content-signals">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-sm">Current Trading Signals</span>
              </div>
              
              <div className="min-h-[200px]" data-testid="signals-container">
                {signals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground" data-testid="no-signals-message">
                    No active trading signals at this time
                  </div>
                ) : (
                  <div className="space-y-2" data-testid="signals-list">
                    {signals.map((signal, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          signal.type === "BUY" 
                            ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800" 
                            : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                        }`}
                        data-testid={`signal-${signal.indicator.toLowerCase()}-${signal.type.toLowerCase()}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {signal.type === "BUY" ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <Badge 
                              variant={signal.type === "BUY" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {signal.type}
                            </Badge>
                            <span className="font-mono text-sm">{signal.indicator}</span>
                          </div>
                          <span className="text-xs font-mono text-muted-foreground">
                            {signal.value}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {signal.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}