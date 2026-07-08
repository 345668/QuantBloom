import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  Bell, 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  TrendingUp, 
  Volume2, 
  Activity,
  Newspaper,
  X,
  Power,
  PowerOff,
  Filter,
  Search
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Alert, AlertCondition, TriggeredAlert, InsertAlert } from "@shared/schema";

type AlertType = Alert['type'];

// Frontend form schema that mirrors the backend insertAlertSchema structure  
const alertFormSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").transform(val => val.toUpperCase()),
  type: z.enum(["price", "news", "volume", "volatility", "breakout"]),
  notificationMethod: z.enum(["popup", "email", "both"]).default("popup"),
  isRecurring: z.boolean().default(false),
  
  // Condition fields - will be transformed to nested condition object
  targetPrice: z.number().positive().optional(),
  priceDirection: z.enum(["above", "below"]).optional(),
  keywords: z.string().min(1).optional(),
  newsSource: z.string().optional(),
  volumeThreshold: z.number().positive().optional(),
  volumeComparison: z.enum(["above", "below", "percent_change"]).optional(),
  volumeTimeframe: z.enum(["1D", "5D", "30D"]).default("1D").optional(),
  volatilityThreshold: z.number().min(0).max(1).optional(),
  volatilityTimeframe: z.enum(["1D", "5D", "30D"]).default("1D").optional(),
  breakoutType: z.enum(["resistance", "support", "pattern"]).optional(),
  technicalPattern: z.enum(["triangle", "flag", "head_shoulders"]).optional(),
  breakoutConfirmation: z.boolean().default(true).optional(),
}).superRefine((data, ctx) => {
  // Type-specific validation rules
  switch (data.type) {
    case 'price':
      if (!data.targetPrice) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price alerts require a target price",
          path: ['targetPrice']
        });
      }
      if (!data.priceDirection) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Price alerts require a direction",
          path: ['priceDirection']
        });
      }
      break;
    case 'news':
      if (!data.keywords) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "News alerts require keywords",
          path: ['keywords']
        });
      }
      break;
    case 'volume':
      if (!data.volumeThreshold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Volume alerts require a threshold",
          path: ['volumeThreshold']
        });
      }
      if (!data.volumeComparison) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Volume alerts require a comparison type",
          path: ['volumeComparison']
        });
      }
      break;
    case 'volatility':
      if (!data.volatilityThreshold) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Volatility alerts require a threshold",
          path: ['volatilityThreshold']
        });
      }
      break;
    case 'breakout':
      if (!data.breakoutType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Breakout alerts require a breakout type",
          path: ['breakoutType']
        });
      }
      break;
  }
});

type AlertFormData = z.infer<typeof alertFormSchema>;

const AlertIcon = ({ type }: { type: AlertType }) => {
  switch (type) {
    case "price":
      return <TrendingUp className="h-4 w-4" />;
    case "news":
      return <Newspaper className="h-4 w-4" />;
    case "volume":
      return <Volume2 className="h-4 w-4" />;
    case "volatility":
      return <Activity className="h-4 w-4" />;
    case "breakout":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Bell className="h-4 w-4" />;
  }
};

const AlertTypeColors = {
  price: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  news: "bg-green-500/10 text-green-400 border-green-500/20",
  volume: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  volatility: "bg-red-500/10 text-red-400 border-red-500/20",
  breakout: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

interface AlertsPanelProps {
  prefilledSymbol?: string;
  onAlertCreate?: (alert: Alert) => void;
}

export default function AlertsPanel({ prefilledSymbol, onAlertCreate }: AlertsPanelProps) {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [selectedTab, setSelectedTab] = useState<"active" | "triggered">("active");
  const [filterType, setFilterType] = useState<AlertType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Auto-open dialog when prefilledSymbol is set (integration from watchlist)
  useEffect(() => {
    if (prefilledSymbol && !isCreateDialogOpen) {
      setIsCreateDialogOpen(true);
    }
  }, [prefilledSymbol, isCreateDialogOpen]);

  // Fetch alerts
  const { data: alerts = [], isLoading: isLoadingAlerts, refetch: refetchAlerts } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
  });

  // Fetch triggered alerts
  const { data: triggeredAlerts = [], isLoading: isLoadingTriggered } = useQuery<TriggeredAlert[]>({
    queryKey: ["/api/alerts/triggered"],
  });

  // Create alert mutation
  const createAlertMutation = useMutation({
    mutationFn: async (data: AlertFormData) => {
      const alertData = transformFormDataToApiFormat(data);
      return await fetch("/api/alerts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(alertData),
      }).then(res => res.json());
    },
    onSuccess: (newAlert) => {
      toast({
        title: "Alert Created",
        description: "Your alert has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setIsCreateDialogOpen(false);
      // Notify parent component of successful creation (for integration cleanup)
      onAlertCreate?.(newAlert);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create alert",
        variant: "destructive",
      });
    },
  });

  // Update alert mutation
  const updateAlertMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Alert> }) => {
      return await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Alert Updated",
        description: "Your alert has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
      setEditingAlert(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update alert",
        variant: "destructive",
      });
    },
  });

  // Delete alert mutation
  const deleteAlertMutation = useMutation({
    mutationFn: async (alertId: string) => {
      return await fetch(`/api/alerts/${alertId}`, {
        method: "DELETE",
      }).then(res => res.json());
    },
    onSuccess: () => {
      toast({
        title: "Alert Deleted",
        description: "Your alert has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/alerts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete alert",
        variant: "destructive",
      });
    },
  });

  const transformFormDataToApiFormat = (formData: AlertFormData) => {
    const baseData = {
      symbol: formData.symbol,
      type: formData.type,
      notificationMethod: formData.notificationMethod,
      isRecurring: formData.isRecurring,
      condition: {} as AlertCondition,
    };

    // Build condition based on alert type
    switch (formData.type) {
      case "price":
        baseData.condition = {
          targetPrice: formData.targetPrice,
          priceDirection: formData.priceDirection,
        };
        break;
      case "news":
        baseData.condition = {
          keywords: formData.keywords ? formData.keywords.split(",").map(k => k.trim()) : [],
          newsSource: formData.newsSource,
        };
        break;
      case "volume":
        baseData.condition = {
          volumeThreshold: formData.volumeThreshold,
          volumeComparison: formData.volumeComparison,
          volumeTimeframe: formData.volumeTimeframe,
        };
        break;
      case "volatility":
        baseData.condition = {
          volatilityThreshold: formData.volatilityThreshold,
          volatilityTimeframe: formData.volatilityTimeframe,
        };
        break;
      case "breakout":
        baseData.condition = {
          breakoutType: formData.breakoutType,
          technicalPattern: formData.technicalPattern,
          breakoutConfirmation: formData.breakoutConfirmation,
        };
        break;
    }

    return baseData;
  };

  const toggleAlertStatus = async (alert: Alert) => {
    const newStatus = alert.status === "active" ? "disabled" : "active";
    await updateAlertMutation.mutateAsync({
      id: alert.id,
      data: { status: newStatus },
    });
  };

  const formatConditionText = (alert: Alert) => {
    const { condition, type } = alert;
    
    switch (type) {
      case "price":
        return `${condition.priceDirection} $${condition.targetPrice}`;
      case "news":
        return `Keywords: ${condition.keywords?.join(", ")}`;
      case "volume":
        return `${condition.volumeComparison} ${condition.volumeThreshold?.toLocaleString()} (${condition.volumeTimeframe})`;
      case "volatility":
        return `> ${(condition.volatilityThreshold! * 100).toFixed(1)}% (${condition.volatilityTimeframe})`;
      case "breakout":
        return `${condition.breakoutType} ${condition.technicalPattern ? `(${condition.technicalPattern})` : ""}`;
      default:
        return "Unknown condition";
    }
  };

  // Filter and search alerts
  const filterAndSearchAlerts = (alertsList: Alert[]) => {
    return alertsList
      .filter(alert => {
        if (filterType !== "all" && alert.type !== filterType) return false;
        if (searchQuery && !alert.symbol.toLowerCase().includes(searchQuery.toLowerCase())) return false;
        return true;
      });
  };

  const activeAlerts = filterAndSearchAlerts(alerts.filter(alert => alert.status !== "triggered"));
  const recentTriggered = triggeredAlerts.slice(0, 10);

  return (
    <div className="h-full flex flex-col bg-black text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-orange-400" />
          <div>
            <h2 className="text-lg font-semibold text-orange-400">Alerts & Monitoring</h2>
            <p className="text-sm text-gray-400">Manage your trading alerts</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            // Clear prefilled symbol when dialog is closed to prevent re-opening loops
            if (!open && prefilledSymbol) {
              onAlertCreate?.();
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                size="sm" 
                className="bg-orange-600 hover:bg-orange-700 text-white"
                data-testid="button-create-alert"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Alert
              </Button>
            </DialogTrigger>
            <AlertFormDialog 
              isOpen={isCreateDialogOpen}
              onClose={() => setIsCreateDialogOpen(false)}
              onSubmit={(data) => createAlertMutation.mutate(data)}
              isLoading={createAlertMutation.isPending}
              prefilledSymbol={prefilledSymbol}
            />
          </Dialog>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectedTab === "active" 
              ? "text-orange-400 border-b-2 border-orange-400" 
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setSelectedTab("active")}
          data-testid="tab-active-alerts"
        >
          Active ({activeAlerts.length})
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            selectedTab === "triggered" 
              ? "text-orange-400 border-b-2 border-orange-400" 
              : "text-gray-400 hover:text-gray-300"
          }`}
          onClick={() => setSelectedTab("triggered")}
          data-testid="tab-triggered-alerts"
        >
          Triggered ({recentTriggered.length})
        </button>
      </div>

      {/* Search and Filter Controls */}
      {selectedTab === "active" && (
        <div className="p-4 border-b border-gray-800 space-y-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search alerts by symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-gray-800 border-gray-700 text-white"
                data-testid="input-search-alerts"
              />
            </div>
            <Select value={filterType} onValueChange={(value) => setFilterType(value as AlertType | "all")}>
              <SelectTrigger className="w-32 h-9 bg-gray-800 border-gray-700 text-white" data-testid="select-filter-type">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="price">Price</SelectItem>
                <SelectItem value="news">News</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="volatility">Volatility</SelectItem>
                <SelectItem value="breakout">Breakout</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {(searchQuery || filterType !== "all") && (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Showing {activeAlerts.length} of {alerts.filter(alert => alert.status !== "triggered").length} alerts</span>
              {(searchQuery || filterType !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterType("all");
                  }}
                  className="h-6 px-2 text-xs"
                  data-testid="button-clear-filters"
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {selectedTab === "active" && (
          <div className="space-y-3">
            {isLoadingAlerts ? (
              <div className="text-center py-8 text-gray-400">Loading alerts...</div>
            ) : activeAlerts.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No active alerts</p>
                <p className="text-sm">Create your first alert to get started</p>
              </div>
            ) : (
              activeAlerts.map((alert) => (
                <Card key={alert.id} className="bg-gray-900 border-gray-800" data-testid={`alert-card-${alert.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${AlertTypeColors[alert.type]}`}>
                          <AlertIcon type={alert.type} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">{alert.symbol}</span>
                            <Badge variant="outline" className="text-xs">
                              {alert.type}
                            </Badge>
                            <Badge 
                              variant={alert.status === "active" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {alert.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400">{formatConditionText(alert)}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Created {new Date(alert.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleAlertStatus(alert)}
                          data-testid={`button-toggle-alert-${alert.id}`}
                        >
                          {alert.status === "active" ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingAlert(alert)}
                          data-testid={`button-edit-alert-${alert.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteAlertMutation.mutate(alert.id)}
                          data-testid={`button-delete-alert-${alert.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {selectedTab === "triggered" && (
          <div className="space-y-3">
            {isLoadingTriggered ? (
              <div className="text-center py-8 text-gray-400">Loading triggered alerts...</div>
            ) : recentTriggered.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No triggered alerts</p>
                <p className="text-sm">Alerts will appear here when conditions are met</p>
              </div>
            ) : (
              recentTriggered.map((triggered, index) => (
                <Card key={index} className="bg-gray-900 border-gray-800" data-testid={`triggered-alert-${index}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-full ${AlertTypeColors[triggered.alert.type]}`}>
                        <AlertIcon type={triggered.alert.type} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-white">{triggered.alert.symbol}</span>
                          <Badge variant="outline" className="text-xs">
                            {triggered.alert.type}
                          </Badge>
                          <Badge variant="destructive" className="text-xs">
                            TRIGGERED
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-300">{triggered.triggerReason}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(triggered.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-orange-400">
                          {typeof triggered.currentValue === "number" 
                            ? `$${triggered.currentValue.toFixed(2)}` 
                            : triggered.currentValue
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Alert Form Dialog Component
function AlertFormDialog({ 
  isOpen, 
  onClose, 
  onSubmit, 
  isLoading,
  initialData,
  prefilledSymbol
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AlertFormData) => void;
  isLoading: boolean;
  initialData?: Partial<AlertFormData>;
  prefilledSymbol?: string;
}) {
  const [selectedType, setSelectedType] = useState<AlertType>("price");

  const form = useForm<AlertFormData>({
    resolver: zodResolver(alertFormSchema),
    defaultValues: {
      symbol: prefilledSymbol || "",
      type: "price",
      notificationMethod: "popup",
      isRecurring: false,
      ...initialData,
    } as AlertFormData,
  });

  // Reset form with prefilled symbol when it changes (integration from watchlist)
  useEffect(() => {
    if (prefilledSymbol) {
      form.reset({
        symbol: prefilledSymbol,
        type: "price",
        notificationMethod: "popup",
        isRecurring: false,
        ...initialData,
      } as AlertFormData);
    }
  }, [prefilledSymbol, form, initialData]);

  const handleSubmit = (data: AlertFormData) => {
    onSubmit(data);
  };

  return (
    <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-800 text-white">
      <DialogHeader>
        <DialogTitle className="text-orange-400">Create New Alert</DialogTitle>
        <DialogDescription className="text-gray-400">
          Set up monitoring for your trading positions
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="AAPL, BTC, etc." 
                      {...field} 
                      data-testid="input-alert-symbol"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Alert Type</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      setSelectedType(value as AlertType);
                    }} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger data-testid="select-alert-type">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="price">Price Alert</SelectItem>
                      <SelectItem value="news">News Alert</SelectItem>
                      <SelectItem value="volume">Volume Alert</SelectItem>
                      <SelectItem value="volatility">Volatility Alert</SelectItem>
                      <SelectItem value="breakout">Breakout Alert</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Type-specific fields */}
          {selectedType === "price" && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="targetPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Price</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        placeholder="150.00" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-target-price"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="priceDirection"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-price-direction">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="below">Below</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedType === "news" && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="earnings, merger, acquisition" 
                        {...field} 
                        data-testid="input-news-keywords"
                      />
                    </FormControl>
                    <FormDescription>
                      Comma-separated keywords to monitor in news
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="newsSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>News Source (Optional)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Reuters, Bloomberg, etc." 
                        {...field} 
                        data-testid="input-news-source"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedType === "volume" && (
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="volumeThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volume Threshold</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        placeholder="1000000" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-volume-threshold"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volumeComparison"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comparison</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-volume-comparison">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="above">Above</SelectItem>
                        <SelectItem value="below">Below</SelectItem>
                        <SelectItem value="percent_change">% Change</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volumeTimeframe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeframe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-volume-timeframe">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1D">1 Day</SelectItem>
                        <SelectItem value="5D">5 Days</SelectItem>
                        <SelectItem value="30D">30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedType === "volatility" && (
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="volatilityThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Volatility Threshold</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        max="1"
                        placeholder="0.05 (5%)" 
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                        data-testid="input-volatility-threshold"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter as decimal (0.05 = 5%)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="volatilityTimeframe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeframe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-volatility-timeframe">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="1D">1 Day</SelectItem>
                        <SelectItem value="5D">5 Days</SelectItem>
                        <SelectItem value="30D">30 Days</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {selectedType === "breakout" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="breakoutType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Breakout Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-breakout-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="resistance">Resistance</SelectItem>
                          <SelectItem value="support">Support</SelectItem>
                          <SelectItem value="pattern">Pattern</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="technicalPattern"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pattern (Optional)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-technical-pattern">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="triangle">Triangle</SelectItem>
                          <SelectItem value="flag">Flag</SelectItem>
                          <SelectItem value="head_shoulders">Head & Shoulders</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="breakoutConfirmation"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-700 p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Require Confirmation
                      </FormLabel>
                      <FormDescription>
                        Wait for confirmation before triggering alert
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-breakout-confirmation"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          )}

          <Separator className="bg-gray-700" />

          {/* Notification settings */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-orange-400">Notification Settings</h4>
            
            <FormField
              control={form.control}
              name="notificationMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notification Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger data-testid="select-notification-method">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="popup">Popup Only</SelectItem>
                      <SelectItem value="email">Email Only</SelectItem>
                      <SelectItem value="both">Popup & Email</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-700 p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">
                      Recurring Alert
                    </FormLabel>
                    <FormDescription>
                      Keep alert active after triggering
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      data-testid="switch-recurring-alert"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel-alert"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700"
              data-testid="button-save-alert"
            >
              {isLoading ? "Creating..." : "Create Alert"}
            </Button>
          </div>
        </form>
      </Form>
    </DialogContent>
  );
}