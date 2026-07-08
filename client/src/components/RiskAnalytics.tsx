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
  PieChart,
  Pie,
  Cell
} from "recharts";
import { 
  Shield, 
  TrendingDown, 
  AlertTriangle, 
  Target, 
  Activity,
  BarChart3,
  TrendingUp
} from "lucide-react";

interface PortfolioRiskMetrics {
  portfolioValue: number;
  portfolioReturns: number[];
  volatility: number;
  sharpeRatio: number;
  beta: number;
  maxDrawdown: number;
  var95: number;
  var99: number;
  correlationMatrix: {
    assets: string[];
    correlations: number[][];
  };
  sectorExposure: Array<{
    sector: string;
    exposure: number;
    weight: number;
    performance: number;
    risk: number;
  }>;
  assetAllocation: Array<{
    type: string;
    weight: number;
    value: number;
    performance: number;
  }>;
  riskMetrics: {
    valueAtRisk: {
      historical: {
        var95: number;
        var99: number;
        expectedShortfall95: number;
        expectedShortfall99: number;
      };
      parametric: {
        var95: number;
        var99: number;
      };
      monteCarlo: {
        var95: number;
        var99: number;
        simulations: number;
      };
    };
    stressTests: Array<{
      scenario: string;
      portfolioImpact: number;
      description: string;
    }>;
    concentrationRisk: number;
  };
}

interface RiskAnalyticsProps {
  selectedTimeframe?: "1M" | "3M" | "6M" | "1Y" | "YTD";
}

export default function RiskAnalytics({ selectedTimeframe = "3M" }: RiskAnalyticsProps) {
  const [timeframe, setTimeframe] = useState(selectedTimeframe);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch risk analytics data from the new backend endpoint
  const { data: riskData, isLoading, error } = useQuery<PortfolioRiskMetrics>({
    queryKey: ["/api/risk-analytics", timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/risk-analytics?timeframe=${timeframe}`);
      if (!response.ok) {
        throw new Error('Failed to fetch risk analytics');
      }
      return response.json();
    },
    refetchInterval: 60000, // Refresh every minute
    enabled: true
  });

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Calculating risk metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Failed to load risk analytics</p>
        </div>
      </div>
    );
  }

  const riskMetrics = riskData || {
    portfolioValue: 0,
    portfolioReturns: [],
    volatility: 0,
    sharpeRatio: 0,
    beta: 1.0,
    maxDrawdown: 0,
    var95: 0,
    var99: 0,
    correlationMatrix: { assets: [], correlations: [] },
    sectorExposure: [],
    assetAllocation: [],
    riskMetrics: {
      valueAtRisk: {
        historical: { var95: 0, var99: 0, expectedShortfall95: 0, expectedShortfall99: 0 },
        parametric: { var95: 0, var99: 0 },
        monteCarlo: { var95: 0, var99: 0, simulations: 10000 }
      },
      stressTests: [],
      concentrationRisk: 0
    }
  };

  // Colors for charts
  const chartColors = ['#ff6b35', '#f7931e', '#ffd23f', '#06ffa5', '#1fb8fd'];

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format percentage
  const formatPercentage = (value: number, decimals: number = 2) => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  // Risk level determination
  const getRiskLevel = (value: number, thresholds: { low: number; medium: number }) => {
    if (value <= thresholds.low) return { level: "Low", color: "text-green-400" };
    if (value <= thresholds.medium) return { level: "Medium", color: "text-yellow-400" };
    return { level: "High", color: "text-red-400" };
  };

  return (
    <div className="h-full flex flex-col space-y-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-400" />
          Risk Analytics
        </h3>
        <Select 
          value={timeframe} 
          onValueChange={(value: string) => setTimeframe(value as any)}
          data-testid="select-risk-timeframe"
        >
          <SelectTrigger className="w-32" data-testid="trigger-risk-timeframe">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1M" data-testid="option-1M">1 Month</SelectItem>
            <SelectItem value="3M" data-testid="option-3M">3 Months</SelectItem>
            <SelectItem value="6M" data-testid="option-6M">6 Months</SelectItem>
            <SelectItem value="1Y" data-testid="option-1Y">1 Year</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="var" data-testid="tab-var">VaR Analysis</TabsTrigger>
          <TabsTrigger value="correlation" data-testid="tab-correlation">Correlation</TabsTrigger>
          <TabsTrigger value="stress" data-testid="tab-stress">Stress Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Key Risk Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Portfolio Beta</p>
                    <p className="text-2xl font-bold" data-testid="text-beta">
                      {riskMetrics.beta.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">vs. SPY</p>
                  </div>
                  <Target className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sharpe Ratio</p>
                    <p className="text-2xl font-bold" data-testid="text-sharpe">
                      {riskMetrics.sharpeRatio.toFixed(2)}
                    </p>
                    <Badge 
                      variant={riskMetrics.sharpeRatio > 1 ? "default" : "secondary"}
                      className="mt-1"
                    >
                      {riskMetrics.sharpeRatio > 1 ? "Good" : "Poor"}
                    </Badge>
                  </div>
                  <BarChart3 className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Volatility</p>
                    <p className="text-2xl font-bold" data-testid="text-volatility">
                      {formatPercentage(riskMetrics.volatility)}
                    </p>
                    <Badge 
                      variant={riskMetrics.volatility > 0.25 ? "destructive" : "default"}
                      className="mt-1"
                    >
                      {getRiskLevel(riskMetrics.volatility, { low: 0.15, medium: 0.25 }).level}
                    </Badge>
                  </div>
                  <Activity className="h-8 w-8 text-orange-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Max Drawdown</p>
                    <p className="text-2xl font-bold text-red-400" data-testid="text-drawdown">
                      -{formatPercentage(riskMetrics.maxDrawdown)}
                    </p>
                    <Badge 
                      variant={riskMetrics.maxDrawdown > 0.20 ? "destructive" : "default"}
                      className="mt-1"
                    >
                      {getRiskLevel(riskMetrics.maxDrawdown, { low: 0.10, medium: 0.20 }).level}
                    </Badge>
                  </div>
                  <TrendingDown className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Portfolio Allocation Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sector Exposure */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sector Exposure</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={riskMetrics.sectorExposure}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="weight"
                      nameKey="sector"
                    >
                      {riskMetrics.sectorExposure.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${(value * 100).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {riskMetrics.sectorExposure.map((sector, index) => (
                    <div key={sector.sector} className="flex justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        <span>{sector.sector}</span>
                      </div>
                      <span>{formatPercentage(sector.weight)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Asset Allocation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Asset Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={riskMetrics.assetAllocation}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="weight"
                      nameKey="type"
                    >
                      {riskMetrics.assetAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => `${(value * 100).toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-2 space-y-1">
                  {riskMetrics.assetAllocation.map((allocation, index) => (
                    <div key={allocation.type} className="flex justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: chartColors[index % chartColors.length] }}
                        />
                        <span>{allocation.type}</span>
                      </div>
                      <span>{formatPercentage(allocation.weight)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="var" className="space-y-4 mt-4">
          {/* VaR Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Historical VaR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">95% VaR (1 day)</span>
                  <span className="font-semibold text-red-400" data-testid="text-historical-var95">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.historical.var95)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">99% VaR (1 day)</span>
                  <span className="font-semibold text-red-400" data-testid="text-historical-var99">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.historical.var99)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Expected Shortfall 95%</span>
                  <span className="font-semibold text-red-400">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.historical.expectedShortfall95)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parametric VaR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">95% VaR (1 day)</span>
                  <span className="font-semibold text-red-400" data-testid="text-parametric-var95">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.parametric.var95)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">99% VaR (1 day)</span>
                  <span className="font-semibold text-red-400" data-testid="text-parametric-var99">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.parametric.var99)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  Assumes normal distribution of returns
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Monte Carlo VaR</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">95% VaR (1 day)</span>
                  <span className="font-semibold text-red-400" data-testid="text-montecarlo-var95">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.monteCarlo.var95)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">99% VaR (1 day)</span>
                  <span className="font-semibold text-red-400" data-testid="text-montecarlo-var99">
                    {formatCurrency(riskMetrics.riskMetrics.valueAtRisk.monteCarlo.var99)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-2">
                  {riskMetrics.riskMetrics.valueAtRisk.monteCarlo.simulations.toLocaleString()} simulations
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Concentration Risk */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Concentration Risk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Herfindahl-Hirschman Index</span>
                <span className="font-semibold" data-testid="text-concentration-risk">
                  {riskMetrics.riskMetrics.concentrationRisk.toFixed(3)}
                </span>
              </div>
              <Progress 
                value={riskMetrics.riskMetrics.concentrationRisk * 100} 
                className="h-2"
              />
              <div className="text-xs text-muted-foreground mt-2">
                Lower values indicate better diversification. Values above 0.25 suggest high concentration.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correlation" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Asset Correlation Matrix</CardTitle>
            </CardHeader>
            <CardContent>
              {riskMetrics.correlationMatrix.assets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left p-1"></th>
                        {riskMetrics.correlationMatrix.assets.map(asset => (
                          <th key={asset} className="text-center p-1 min-w-[60px]">{asset}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {riskMetrics.correlationMatrix.assets.map((asset, i) => (
                        <tr key={asset}>
                          <td className="text-left p-1 font-medium">{asset}</td>
                          {riskMetrics.correlationMatrix.correlations[i]?.map((corr, j) => (
                            <td 
                              key={j} 
                              className="text-center p-1"
                              style={{
                                backgroundColor: `rgba(${corr > 0 ? '34, 197, 94' : '239, 68, 68'}, ${Math.abs(corr) * 0.3})`,
                                color: Math.abs(corr) > 0.5 ? 'white' : 'inherit'
                              }}
                            >
                              {corr.toFixed(2)}
                            </td>
                          )) || <td className="text-center p-1">--</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                  <p>Insufficient data for correlation analysis</p>
                  <p className="text-xs">Add more positions or extend timeframe</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stress" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stress Test Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {riskMetrics.riskMetrics.stressTests.map((test, index) => (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-sm">{test.scenario}</h4>
                        <p className="text-xs text-muted-foreground">{test.description}</p>
                      </div>
                      <Badge 
                        variant={test.portfolioImpact < -15 ? "destructive" : test.portfolioImpact < -5 ? "secondary" : "default"}
                        data-testid={`badge-stress-${index}`}
                      >
                        {test.portfolioImpact.toFixed(1)}%
                      </Badge>
                    </div>
                    <Progress 
                      value={Math.abs(test.portfolioImpact)} 
                      className="h-2"
                    />
                  </div>
                ))}
                {riskMetrics.riskMetrics.stressTests.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                    <p>No stress test data available</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}