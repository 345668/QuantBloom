import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Cell
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Target,
  ArrowUpRight,
  ArrowDownRight,
  BarChart3
} from "lucide-react";

interface SectorData {
  sector: string;
  currentWeight: number;
  performance1D: number;
  performance1W: number;
  performance1M: number;
  performance3M: number;
  performance1Y: number;
  relativeStrength: number;
  momentum: number;
  volatility: number;
  sharpeRatio: number;
  marketCap: number;
  priceToEarnings: number;
  dividend: number;
  beta: number;
}

interface SectorRotationData {
  sector: string;
  relativeStrength: number;
  momentum: number;
  quadrant: 'Leading' | 'Weakening' | 'Lagging' | 'Improving';
  x: number; // relative strength
  y: number; // momentum
}

interface SectorAnalysisProps {
  selectedTimeframe?: "1M" | "3M" | "6M" | "1Y";
}

export default function SectorAnalysis({ selectedTimeframe = "3M" }: SectorAnalysisProps) {
  const [timeframe, setTimeframe] = useState(selectedTimeframe);
  const [activeTab, setActiveTab] = useState("performance");
  const [sortBy, setSortBy] = useState<keyof SectorData>("performance1M");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Mock sector data - in real app, this would come from API
  const { data: sectorData, isLoading } = useQuery<SectorData[]>({
    queryKey: ["/api/sector-analysis", timeframe],
    queryFn: async () => {
      // Simulate API call - replace with real endpoint
      return [
        {
          sector: "Technology",
          currentWeight: 0.25,
          performance1D: 0.012,
          performance1W: 0.035,
          performance1M: 0.089,
          performance3M: 0.156,
          performance1Y: 0.289,
          relativeStrength: 1.15,
          momentum: 0.067,
          volatility: 0.185,
          sharpeRatio: 1.34,
          marketCap: 2800000000000,
          priceToEarnings: 28.5,
          dividend: 0.008,
          beta: 1.12
        },
        {
          sector: "Healthcare",
          currentWeight: 0.18,
          performance1D: 0.005,
          performance1W: 0.018,
          performance1M: 0.045,
          performance3M: 0.078,
          performance1Y: 0.134,
          relativeStrength: 0.98,
          momentum: 0.023,
          volatility: 0.142,
          sharpeRatio: 0.89,
          marketCap: 1650000000000,
          priceToEarnings: 22.1,
          dividend: 0.022,
          beta: 0.87
        },
        {
          sector: "Financial Services",
          currentWeight: 0.15,
          performance1D: 0.008,
          performance1W: 0.028,
          performance1M: 0.067,
          performance3M: 0.112,
          performance1Y: 0.198,
          relativeStrength: 1.08,
          momentum: 0.045,
          volatility: 0.168,
          sharpeRatio: 1.12,
          marketCap: 1450000000000,
          priceToEarnings: 15.8,
          dividend: 0.035,
          beta: 1.23
        },
        {
          sector: "Consumer Cyclical",
          currentWeight: 0.12,
          performance1D: 0.003,
          performance1W: 0.012,
          performance1M: 0.034,
          performance3M: 0.056,
          performance1Y: 0.089,
          relativeStrength: 0.92,
          momentum: 0.018,
          volatility: 0.156,
          sharpeRatio: 0.67,
          marketCap: 980000000000,
          priceToEarnings: 19.4,
          dividend: 0.018,
          beta: 1.05
        },
        {
          sector: "Industrial",
          currentWeight: 0.10,
          performance1D: 0.006,
          performance1W: 0.022,
          performance1M: 0.054,
          performance3M: 0.089,
          performance1Y: 0.145,
          relativeStrength: 1.02,
          momentum: 0.035,
          volatility: 0.174,
          sharpeRatio: 0.95,
          marketCap: 850000000000,
          priceToEarnings: 18.7,
          dividend: 0.028,
          beta: 1.08
        },
        {
          sector: "Energy",
          currentWeight: 0.08,
          performance1D: 0.015,
          performance1W: 0.045,
          performance1M: 0.098,
          performance3M: 0.234,
          performance1Y: 0.345,
          relativeStrength: 1.28,
          momentum: 0.089,
          volatility: 0.285,
          sharpeRatio: 1.45,
          marketCap: 650000000000,
          priceToEarnings: 12.3,
          dividend: 0.045,
          beta: 1.35
        },
        {
          sector: "Communication Services",
          currentWeight: 0.07,
          performance1D: -0.002,
          performance1W: 0.008,
          performance1M: 0.023,
          performance3M: 0.034,
          performance1Y: 0.067,
          relativeStrength: 0.85,
          momentum: 0.012,
          volatility: 0.192,
          sharpeRatio: 0.54,
          marketCap: 720000000000,
          priceToEarnings: 25.6,
          dividend: 0.015,
          beta: 0.95
        },
        {
          sector: "Cryptocurrency",
          currentWeight: 0.05,
          performance1D: 0.025,
          performance1W: 0.078,
          performance1M: 0.156,
          performance3M: 0.289,
          performance1Y: 0.456,
          relativeStrength: 1.45,
          momentum: 0.123,
          volatility: 0.425,
          sharpeRatio: 1.23,
          marketCap: 450000000000,
          priceToEarnings: 0,
          dividend: 0,
          beta: 1.67
        }
      ];
    },
    refetchInterval: 60000
  });

  // Calculate sector rotation data
  const sectorRotationData: SectorRotationData[] = (sectorData || []).map(sector => {
    const relativeStrength = sector.relativeStrength;
    const momentum = sector.momentum;
    
    let quadrant: SectorRotationData['quadrant'];
    if (relativeStrength > 1 && momentum > 0.03) {
      quadrant = 'Leading';
    } else if (relativeStrength > 1 && momentum <= 0.03) {
      quadrant = 'Weakening';
    } else if (relativeStrength <= 1 && momentum <= 0.03) {
      quadrant = 'Lagging';
    } else {
      quadrant = 'Improving';
    }

    return {
      sector: sector.sector,
      relativeStrength,
      momentum,
      quadrant,
      x: (relativeStrength - 0.5) * 100, // Scale for visualization
      y: momentum * 100
    };
  });

  // Sort sectors
  const sortedSectors = [...(sectorData || [])].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    return sortOrder === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  // Format functions
  const formatPercentage = (value: number, decimals: number = 2) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const formatCurrency = (value: number, short: boolean = true) => {
    if (short && value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}T`;
    } else if (short && value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}B`;
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getPerformanceColor = (value: number) => {
    return value >= 0 ? "text-green-400" : "text-red-400";
  };

  const getPerformanceIcon = (value: number) => {
    return value >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />;
  };

  const quadrantColors = {
    Leading: '#22c55e',    // Green
    Weakening: '#f59e0b',  // Yellow  
    Lagging: '#ef4444',    // Red
    Improving: '#3b82f6'   // Blue
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Loading sector analysis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-400" />
          Sector Analysis
        </h3>
        <div className="flex items-center gap-2">
          <Select 
            value={sortBy} 
            onValueChange={(value: string) => setSortBy(value as keyof SectorData)}
            data-testid="select-sort-by"
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="performance1M">1M Performance</SelectItem>
              <SelectItem value="performance3M">3M Performance</SelectItem>
              <SelectItem value="relativeStrength">Rel. Strength</SelectItem>
              <SelectItem value="momentum">Momentum</SelectItem>
              <SelectItem value="volatility">Volatility</SelectItem>
              <SelectItem value="sharpeRatio">Sharpe Ratio</SelectItem>
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            data-testid="button-sort-order"
          >
            {sortOrder === "desc" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
          </Button>

          <Select 
            value={timeframe} 
            onValueChange={(value: string) => setTimeframe(value as any)}
            data-testid="select-timeframe"
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1M">1 Month</SelectItem>
              <SelectItem value="3M">3 Months</SelectItem>
              <SelectItem value="6M">6 Months</SelectItem>
              <SelectItem value="1Y">1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
          <TabsTrigger value="rotation" data-testid="tab-rotation">Rotation</TabsTrigger>
          <TabsTrigger value="fundamentals" data-testid="tab-fundamentals">Fundamentals</TabsTrigger>
          <TabsTrigger value="risk" data-testid="tab-risk">Risk Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="performance" className="space-y-4 mt-4">
          {/* Performance Overview */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Performance Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sector Performance ({timeframe})</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={sortedSectors} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="sector" 
                      stroke="#9ca3af"
                      fontSize={10}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <Tooltip 
                      formatter={(value: any) => [`${(value * 100).toFixed(2)}%`, 'Performance']}
                      labelStyle={{ color: '#000' }}
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    />
                    <Bar 
                      dataKey={`performance${timeframe}`} 
                      radius={[2, 2, 0, 0]}
                    >
                      {sortedSectors.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry[`performance${timeframe}` as keyof SectorData] as number >= 0 ? '#22c55e' : '#ef4444'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sector Rankings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {sortedSectors.slice(0, 8).map((sector, index) => (
                    <div key={sector.sector} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-orange-400 text-xs flex items-center justify-center text-black font-semibold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{sector.sector}</p>
                          <p className="text-xs text-muted-foreground">
                            Weight: {formatPercentage(sector.currentWeight)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`flex items-center gap-1 ${getPerformanceColor(sector[`performance${timeframe}` as keyof SectorData] as number)}`}>
                          {getPerformanceIcon(sector[`performance${timeframe}` as keyof SectorData] as number)}
                          <span className="font-semibold text-sm" data-testid={`text-performance-${index}`}>
                            {formatPercentage(sector[`performance${timeframe}` as keyof SectorData] as number)}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          RS: {sector.relativeStrength.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Performance Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-2">Sector</th>
                      <th className="text-right p-2">1D</th>
                      <th className="text-right p-2">1W</th>
                      <th className="text-right p-2">1M</th>
                      <th className="text-right p-2">3M</th>
                      <th className="text-right p-2">1Y</th>
                      <th className="text-right p-2">Rel. Strength</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSectors.map((sector, index) => (
                      <tr key={sector.sector} className="border-b border-gray-800">
                        <td className="p-2 font-medium">{sector.sector}</td>
                        <td className={`p-2 text-right ${getPerformanceColor(sector.performance1D)}`}>
                          {formatPercentage(sector.performance1D)}
                        </td>
                        <td className={`p-2 text-right ${getPerformanceColor(sector.performance1W)}`}>
                          {formatPercentage(sector.performance1W)}
                        </td>
                        <td className={`p-2 text-right ${getPerformanceColor(sector.performance1M)}`}>
                          {formatPercentage(sector.performance1M)}
                        </td>
                        <td className={`p-2 text-right ${getPerformanceColor(sector.performance3M)}`}>
                          {formatPercentage(sector.performance3M)}
                        </td>
                        <td className={`p-2 text-right ${getPerformanceColor(sector.performance1Y)}`}>
                          {formatPercentage(sector.performance1Y)}
                        </td>
                        <td className="p-2 text-right">
                          <Badge 
                            variant={sector.relativeStrength > 1.1 ? "default" : sector.relativeStrength > 0.9 ? "secondary" : "destructive"}
                          >
                            {sector.relativeStrength.toFixed(2)}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rotation" className="space-y-4 mt-4">
          {/* Sector Rotation Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sector Rotation Chart (RRG Style)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Relative Strength vs Momentum - Shows sector rotation dynamics
              </p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number" 
                    dataKey="x" 
                    name="Relative Strength"
                    stroke="#9ca3af"
                    domain={[-50, 50]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="y" 
                    name="Momentum"
                    stroke="#9ca3af"
                    domain={[0, 15]}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === 'Relative Strength') return [`${value.toFixed(1)}%`, name];
                      if (name === 'Momentum') return [`${value.toFixed(1)}%`, name];
                      return [value, name];
                    }}
                    labelFormatter={(label, payload) => {
                      const data = payload?.[0]?.payload;
                      return data ? `${data.sector} (${data.quadrant})` : label;
                    }}
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                  />
                  {Object.entries(
                    sectorRotationData.reduce((acc, sector) => {
                      if (!acc[sector.quadrant]) acc[sector.quadrant] = [];
                      acc[sector.quadrant].push(sector);
                      return acc;
                    }, {} as Record<string, SectorRotationData[]>)
                  ).map(([quadrant, sectors]) => (
                    <Scatter 
                      key={quadrant}
                      name={quadrant}
                      data={sectors}
                      fill={quadrantColors[quadrant as keyof typeof quadrantColors]}
                    />
                  ))}
                  
                  {/* Quadrant lines */}
                  <Line x1={0} y1={0} x2={0} y2="100%" stroke="#6b7280" strokeDasharray="5 5" />
                  <Line x1="0%" y1={7.5} x2="100%" y2={7.5} stroke="#6b7280" strokeDasharray="5 5" />
                </ScatterChart>
              </ResponsiveContainer>
              
              {/* Quadrant Legend */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-4">
                {Object.entries(quadrantColors).map(([quadrant, color]) => (
                  <div key={quadrant} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-xs">{quadrant}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rotation Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {Object.entries(
              sectorRotationData.reduce((acc, sector) => {
                if (!acc[sector.quadrant]) acc[sector.quadrant] = [];
                acc[sector.quadrant].push(sector);
                return acc;
              }, {} as Record<string, SectorRotationData[]>)
            ).map(([quadrant, sectors]) => (
              <Card key={quadrant}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: quadrantColors[quadrant as keyof typeof quadrantColors] }}
                    />
                    {quadrant}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {sectors.map(sector => (
                      <div key={sector.sector} className="text-xs">
                        <div className="font-medium">{sector.sector}</div>
                        <div className="text-muted-foreground">
                          RS: {sector.relativeStrength.toFixed(2)}, M: {formatPercentage(sector.momentum)}
                        </div>
                      </div>
                    ))}
                    {sectors.length === 0 && (
                      <div className="text-xs text-muted-foreground">No sectors</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="fundamentals" className="space-y-4 mt-4">
          {/* Fundamentals Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sector Fundamentals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-2">Sector</th>
                      <th className="text-right p-2">Market Cap</th>
                      <th className="text-right p-2">P/E Ratio</th>
                      <th className="text-right p-2">Dividend</th>
                      <th className="text-right p-2">Beta</th>
                      <th className="text-right p-2">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSectors.map((sector, index) => (
                      <tr key={sector.sector} className="border-b border-gray-800">
                        <td className="p-2 font-medium">{sector.sector}</td>
                        <td className="p-2 text-right">{formatCurrency(sector.marketCap)}</td>
                        <td className="p-2 text-right">
                          {sector.priceToEarnings > 0 ? sector.priceToEarnings.toFixed(1) : 'N/A'}
                        </td>
                        <td className="p-2 text-right">{formatPercentage(sector.dividend)}</td>
                        <td className="p-2 text-right">
                          <Badge 
                            variant={sector.beta > 1.2 ? "destructive" : sector.beta < 0.8 ? "secondary" : "default"}
                          >
                            {sector.beta.toFixed(2)}
                          </Badge>
                        </td>
                        <td className="p-2 text-right">{formatPercentage(sector.currentWeight)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-4 mt-4">
          {/* Risk Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Volatility Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sortedSectors}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="sector" 
                      stroke="#9ca3af"
                      fontSize={10}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <Tooltip 
                      formatter={(value: any) => [`${(value * 100).toFixed(1)}%`, 'Volatility']}
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    />
                    <Bar dataKey="volatility" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Risk-Adjusted Returns</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={sortedSectors}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="sector" 
                      stroke="#9ca3af"
                      fontSize={10}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#9ca3af" fontSize={10} />
                    <Tooltip 
                      formatter={(value: any) => [value.toFixed(2), 'Sharpe Ratio']}
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                    />
                    <Bar dataKey="sharpeRatio" fill="#06ffa5" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Risk Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Risk Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div>
                  <h4 className="font-medium text-sm mb-2">Highest Volatility</h4>
                  <div className="space-y-1">
                    {[...sortedSectors]
                      .sort((a, b) => b.volatility - a.volatility)
                      .slice(0, 3)
                      .map(sector => (
                        <div key={sector.sector} className="flex justify-between text-xs">
                          <span>{sector.sector}</span>
                          <span className="text-red-400">{formatPercentage(sector.volatility)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-2">Best Sharpe Ratio</h4>
                  <div className="space-y-1">
                    {[...sortedSectors]
                      .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
                      .slice(0, 3)
                      .map(sector => (
                        <div key={sector.sector} className="flex justify-between text-xs">
                          <span>{sector.sector}</span>
                          <span className="text-green-400">{sector.sharpeRatio.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm mb-2">Highest Beta</h4>
                  <div className="space-y-1">
                    {[...sortedSectors]
                      .sort((a, b) => b.beta - a.beta)
                      .slice(0, 3)
                      .map(sector => (
                        <div key={sector.sector} className="flex justify-between text-xs">
                          <span>{sector.sector}</span>
                          <span className="text-orange-400">{sector.beta.toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}