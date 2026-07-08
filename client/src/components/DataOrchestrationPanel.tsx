import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Database, 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  BarChart3,
  Clock,
  Zap
} from "lucide-react";
import { useDataOrchestrationHealth } from "@/hooks/useDataOrchestration";

export default function DataOrchestrationPanel() {
  const { sourceHealth, cacheStats, validationErrors, invalidateAllCache } = useDataOrchestrationHealth();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    invalidateAllCache();
    setTimeout(() => setIsRefreshing(false), 2000);
  };

  const getSourceStatusIcon = (isAvailable: boolean, errorCount: number) => {
    if (!isAvailable) return <XCircle className="w-4 h-4 text-destructive" />;
    if (errorCount > 0) return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  };

  const getSourceStatusColor = (isAvailable: boolean, errorCount: number) => {
    if (!isAvailable) return "destructive";
    if (errorCount > 0) return "secondary";
    return "default";
  };

  const totalSources = sourceHealth.size;
  const availableSources = Array.from(sourceHealth.values()).filter(s => s.isAvailable).length;
  const healthPercentage = totalSources > 0 ? (availableSources / totalSources) * 100 : 0;

  return (
    <div className="space-y-6" data-testid="data-orchestration-panel">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-mono font-bold text-primary tracking-wide">
            DATA ORCHESTRATION
          </h2>
          <p className="text-sm text-muted-foreground font-mono">
            Real-time data processing and validation pipeline
          </p>
        </div>
        
        <Button
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          size="sm"
          variant="outline"
          className="font-mono hover-elevate"
          data-testid="button-refresh-all-data"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh All
        </Button>
      </div>

      {/* System Health Overview */}
      <Card className="bg-card border-card-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-mono text-primary flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health
          </CardTitle>
          <CardDescription className="font-mono">
            Overall data pipeline status and performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Source Health</span>
                <span className="text-sm font-mono font-medium">
                  {availableSources}/{totalSources}
                </span>
              </div>
              <Progress value={healthPercentage} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Cache Hit Rate</span>
                <span className="text-sm font-mono font-medium">
                  {(cacheStats.hitRate * 100).toFixed(1)}%
                </span>
              </div>
              <Progress value={cacheStats.hitRate * 100} className="h-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono text-muted-foreground">Cache Size</span>
                <span className="text-sm font-mono font-medium">
                  {cacheStats.size} entries
                </span>
              </div>
              <Progress value={Math.min((cacheStats.size / 100) * 100, 100)} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Sources */}
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg font-mono text-primary flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Sources
            </CardTitle>
            <CardDescription className="font-mono">
              Status and health of all data providers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {Array.from(sourceHealth.entries()).map(([name, source]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/5 hover-elevate"
                    data-testid={`data-source-${name}`}
                  >
                    <div className="flex items-center gap-3">
                      {getSourceStatusIcon(source.isAvailable, source.errorCount)}
                      <div>
                        <p className="text-sm font-mono font-medium">
                          {name.replace('_', ' ').toUpperCase()}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">
                          Priority: {source.priority} | Last: {source.lastUpdate.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {source.errorCount > 0 && (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {source.errorCount} errors
                        </Badge>
                      )}
                      <Badge 
                        variant={getSourceStatusColor(source.isAvailable, source.errorCount)}
                        className="font-mono text-xs"
                      >
                        {source.isAvailable ? 'Online' : 'Offline'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Cache Management */}
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg font-mono text-primary flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Cache Management
            </CardTitle>
            <CardDescription className="font-mono">
              Active cache entries and performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-mono text-muted-foreground">Total Entries</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {cacheStats.size}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-mono text-muted-foreground">Hit Rate</p>
                  <p className="text-2xl font-mono font-bold text-primary">
                    {(cacheStats.hitRate * 100).toFixed(1)}%
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono text-muted-foreground">Recent Cache Keys</span>
                </div>
                <ScrollArea className="h-[180px]">
                  <div className="space-y-2">
                    {cacheStats.keys.slice(0, 10).map((key, index) => (
                      <div
                        key={index}
                        className="p-2 rounded-md bg-muted/10 border border-border"
                        data-testid={`cache-key-${index}`}
                      >
                        <p className="text-xs font-mono text-foreground truncate">
                          {key}
                        </p>
                      </div>
                    ))}
                    {cacheStats.keys.length === 0 && (
                      <p className="text-sm text-muted-foreground font-mono text-center py-4">
                        No cache entries
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Validation Errors */}
      {validationErrors.size > 0 && (
        <Card className="bg-card border-card-border">
          <CardHeader>
            <CardTitle className="text-lg font-mono text-primary flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" />
              Validation Errors
            </CardTitle>
            <CardDescription className="font-mono">
              Data validation issues requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from(validationErrors.entries()).map(([dataType, errors]) => (
                <Alert key={dataType} className="border-yellow-500/20 bg-yellow-500/5">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <AlertDescription className="font-mono">
                    <div className="space-y-1">
                      <p className="font-semibold text-sm">{dataType.toUpperCase()}</p>
                      <ul className="text-xs space-y-1 ml-4">
                        {errors.map((error, index) => (
                          <li key={index} className="list-disc">
                            {error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      <Card className="bg-card border-card-border">
        <CardHeader>
          <CardTitle className="text-lg font-mono text-primary flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Performance Metrics
          </CardTitle>
          <CardDescription className="font-mono">
            Data pipeline performance and throughput metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center space-y-1">
              <p className="text-sm font-mono text-muted-foreground">Avg Response</p>
              <p className="text-xl font-mono font-bold text-primary">45ms</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-mono text-muted-foreground">Throughput</p>
              <p className="text-xl font-mono font-bold text-primary">1.2k/min</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-mono text-muted-foreground">Success Rate</p>
              <p className="text-xl font-mono font-bold text-primary">99.8%</p>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-mono text-muted-foreground">Uptime</p>
              <p className="text-xl font-mono font-bold text-primary">99.9%</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}