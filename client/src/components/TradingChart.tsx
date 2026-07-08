import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell
} from "recharts";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Bitcoin, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { isCrypto, getApiEndpoint, formatPrice, formatVolume } from "@/lib/utils";

interface ChartDataPoint {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingChartProps {
  symbol: string;
  interval?: "1D" | "5D" | "1M" | "3M" | "1Y";
}

export default function TradingChart({ 
  symbol,
  interval: initialInterval = "1D"
}: TradingChartProps) {
  const [interval, setInterval] = useState(initialInterval);
  
  const isCryptoSymbol = isCrypto(symbol);
  
  // Fetch chart data
  const { data: rawData = [], isLoading, error } = useQuery<ChartDataPoint[]>({
    queryKey: [isCryptoSymbol ? "/api/crypto/chart" : "/api/chart", symbol, interval],
    queryFn: async () => {
      const endpoint = getApiEndpoint(symbol, 'chart');
      const response = await fetch(`${endpoint}?interval=${interval}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chart data');
      }
      const data = await response.json();
      return data.map((item: any) => ({
        ...item,
        timestamp: new Date(item.timestamp)
      }));
    },
    enabled: !!symbol,
    refetchInterval: 30000
  });
  
  // Format data for chart
  const data = rawData.map(item => ({
    ...item,
    timestamp: format(item.timestamp, interval === '1D' ? 'HH:mm' : 'MMM dd')
  }));
  const [chartType, setChartType] = useState<"line" | "candlestick">("line");
  const [showVolume, setShowVolume] = useState(true);

  const intervals = ["1D", "5D", "1M", "3M", "1Y"];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-popover border border-popover-border p-3 rounded-md shadow-lg">
          <p className="text-sm font-mono text-popover-foreground mb-2">{label}</p>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Open:</span>
              <span>{formatPrice(data.open || 0, symbol)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">High:</span>
              <span className="text-green-500">{formatPrice(data.high || 0, symbol)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Low:</span>
              <span className="text-red-500">{formatPrice(data.low || 0, symbol)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Close:</span>
              <span>{formatPrice(data.close || 0, symbol)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Volume:</span>
              <span>{formatVolume(data.volume || 0, symbol)}</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom candlestick shape renderer
  const CandlestickShape = (props: any) => {
    const { x, y, width, height, payload } = props;
    const { open, close, high, low } = payload;
    
    const isGreen = close >= open;
    const color = isGreen ? "hsl(var(--chart-2))" : "hsl(var(--destructive))";
    
    // Calculate positions
    const candleWidth = Math.max(width * 0.6, 2);
    const candleX = x + (width - candleWidth) / 2;
    
    // Find the y-scale from the chart
    const yScale = props.yAxis?.scale;
    if (!yScale) return null;
    
    const highY = yScale(high);
    const lowY = yScale(low);
    const openY = yScale(open);
    const closeY = yScale(close);
    
    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(bodyBottom - bodyTop, 1);
    
    return (
      <g>
        <line
          x1={x + width / 2}
          y1={highY}
          x2={x + width / 2}
          y2={lowY}
          stroke={color}
          strokeWidth={1}
        />
        <rect
          x={candleX}
          y={bodyTop}
          width={candleWidth}
          height={bodyHeight}
          fill={color}
          stroke={color}
          strokeWidth={1}
        />
      </g>
    );
  };

  return (
    <Card className="h-96">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-mono">{symbol} Chart</CardTitle>
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
          <div className="flex items-center gap-2">
            <div className="flex">
              {intervals.map((int) => (
                <Button
                  key={int}
                  data-testid={`button-interval-${int.toLowerCase()}`}
                  size="sm"
                  variant={interval === int ? "default" : "ghost"}
                  onClick={() => {
                    setInterval(int as "1D" | "5D" | "1M" | "3M" | "1Y");
                  }}
                  className="px-2 py-1 text-xs h-7"
                  disabled={isLoading}
                >
                  {int}
                </Button>
              ))}
            </div>
            
            <div className="flex items-center gap-1">
              <Button
                data-testid="button-chart-line"
                size="sm"
                variant={chartType === "line" ? "default" : "ghost"}
                onClick={() => {
                  setChartType("line");
                }}
                className="px-2 py-1 text-xs h-7"
              >
                Line
              </Button>
              <Button
                data-testid="button-chart-candle"
                size="sm"
                variant={chartType === "candlestick" ? "default" : "ghost"}
                onClick={() => {
                  setChartType("candlestick");
                }}
                className="px-2 py-1 text-xs h-7"
              >
                Candle
              </Button>
            </div>
            
            <Button
              data-testid="button-toggle-volume"
              size="sm"
              variant={showVolume ? "default" : "ghost"}
              onClick={() => {
                setShowVolume(!showVolume);
              }}
              className="px-2 py-1 text-xs h-7"
            >
              Vol {showVolume ? "ON" : "OFF"}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-2">
        {isLoading ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-destructive text-sm">Failed to load chart data</div>
          </div>
        ) : data.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center">
            <div className="text-muted-foreground text-sm">No chart data available</div>
          </div>
        ) : (
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.3}
            />
            <XAxis 
              dataKey="timestamp" 
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              yAxisId="price"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              domain={['dataMin - 1', 'dataMax + 1']}
            />
            {showVolume && (
              <YAxis 
                yAxisId="volume"
                orientation="right"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                domain={[0, 'dataMax * 1.5']}
              />
            )}
            <Tooltip content={<CustomTooltip />} />
            
            {chartType === "line" ? (
              <Line
                type="monotone"
                dataKey="close"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                yAxisId="price"
              />
            ) : (
              <Bar
                dataKey="high"
                shape={<CandlestickShape />}
                isAnimationActive={false}
                yAxisId="price"
              />
            )}
            
            {showVolume && (
              <Bar 
                dataKey="volume" 
                fill="hsl(var(--muted))" 
                opacity={0.3}
                yAxisId="volume"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
