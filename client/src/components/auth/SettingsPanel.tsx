import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Settings, Monitor, Volume2, Clock, BarChart3, Palette, Globe, Bell, Shield, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

interface SettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Preferences form schema
const preferencesSchema = z.object({
  defaultLayout: z.enum(["grid", "single", "tabs"]),
  theme: z.enum(["dark", "light", "auto"]),
  fontSize: z.enum(["small", "medium", "large"]),
  soundEnabled: z.boolean(),
  autoRefreshInterval: z.number().min(5).max(300),
  enableRealTimeData: z.boolean(),
  defaultChartType: z.enum(["line", "candlestick", "area"]),
  defaultTimeframe: z.enum(["1D", "5D", "1M", "3M", "1Y"]),
  showVolume: z.boolean(),
  showIndicators: z.boolean(),
  emailNotifications: z.boolean(),
  browserNotifications: z.boolean(),
  alertSounds: z.boolean(),
  tradingHours: z.enum(["market", "extended", "24h"])
});

type PreferencesFormData = z.infer<typeof preferencesSchema>;

export default function SettingsPanel({ open, onOpenChange }: SettingsPanelProps) {
  const { user, updatePreferences } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<PreferencesFormData>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: {
      defaultLayout: (user?.preferences?.defaultLayout as "grid" | "single" | "tabs") || "grid",
      theme: (user?.preferences?.theme as "dark" | "light" | "auto") || "dark",
      fontSize: (user?.preferences?.fontSize as "small" | "medium" | "large") || "medium",
      soundEnabled: user?.preferences?.soundEnabled || false,
      autoRefreshInterval: user?.preferences?.autoRefreshInterval || 30,
      enableRealTimeData: user?.preferences?.enableRealTimeData || true,
      defaultChartType: (user?.preferences?.defaultChartType as "line" | "candlestick" | "area") || "candlestick",
      defaultTimeframe: (user?.preferences?.defaultTimeframe as "1D" | "5D" | "1M" | "3M" | "1Y") || "1D",
      showVolume: user?.preferences?.showVolume || true,
      showIndicators: user?.preferences?.showIndicators || false,
      emailNotifications: user?.preferences?.emailNotifications || false,
      browserNotifications: user?.preferences?.browserNotifications || true,
      alertSounds: user?.preferences?.alertSounds || false,
      tradingHours: (user?.preferences?.tradingHours as "market" | "extended" | "24h") || "market"
    }
  });

  const onSubmit = async (data: PreferencesFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await updatePreferences(data);
      setSuccess("Terminal preferences updated successfully!");
      
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const resetToDefaults = () => {
    form.reset({
      defaultLayout: "grid",
      theme: "dark",
      fontSize: "medium",
      soundEnabled: false,
      autoRefreshInterval: 30,
      enableRealTimeData: true,
      defaultChartType: "candlestick",
      defaultTimeframe: "1D",
      showVolume: true,
      showIndicators: false,
      emailNotifications: false,
      browserNotifications: true,
      alertSounds: false,
      tradingHours: "market"
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-4xl h-[90vh] bg-card border-card-border"
        data-testid="settings-panel"
      >
        <DialogHeader className="border-b border-card-border pb-4">
          <DialogTitle className="text-primary font-mono text-xl uppercase tracking-wide flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Terminal Preferences
          </DialogTitle>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Customize your Bloom Terminal experience
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-auto px-1">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Status Messages */}
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  <p className="text-destructive text-sm font-mono">{error}</p>
                </div>
              )}
              
              {success && (
                <div className="bg-chart-2/10 border border-chart-2/20 rounded-md p-3">
                  <p className="text-chart-2 text-sm font-mono">{success}</p>
                </div>
              )}

              {/* Display Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-mono font-semibold text-primary uppercase tracking-wide">
                    Display Settings
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                          Theme
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-theme" className="bg-input border-border font-mono">
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="dark">Dark (Recommended)</SelectItem>
                            <SelectItem value="light">Light</SelectItem>
                            <SelectItem value="auto">Auto</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-destructive text-xs font-mono" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fontSize"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                          Font Size
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-font-size" className="bg-input border-border font-mono">
                              <SelectValue placeholder="Select size" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="small">Small</SelectItem>
                            <SelectItem value="medium">Medium (Recommended)</SelectItem>
                            <SelectItem value="large">Large</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-destructive text-xs font-mono" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="defaultLayout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                          Default Layout
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-layout" className="bg-input border-border font-mono">
                              <SelectValue placeholder="Select layout" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="grid">Grid (Recommended)</SelectItem>
                            <SelectItem value="single">Single Panel</SelectItem>
                            <SelectItem value="tabs">Tabbed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-destructive text-xs font-mono" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator className="border-card-border" />

              {/* Real-time Data Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-mono font-semibold text-primary uppercase tracking-wide">
                    Real-time Data
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="enableRealTimeData"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Live Market Data
                          </FormLabel>
                          <div className="text-xs text-muted-foreground font-mono">
                            Enable real-time price updates
                          </div>
                        </div>
                        <FormControl>
                          <Switch
                            data-testid="switch-real-time-data"
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoRefreshInterval"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                          Refresh Interval (seconds)
                        </FormLabel>
                        <FormControl>
                          <Input
                            data-testid="input-refresh-interval"
                            type="number"
                            min={5}
                            max={300}
                            placeholder="30"
                            className="bg-input border-border font-mono"
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground font-mono">
                          Data refresh rate (5-300 seconds)
                        </div>
                        <FormMessage className="text-destructive text-xs font-mono" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator className="border-card-border" />

              {/* Chart Preferences */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-mono font-semibold text-primary uppercase tracking-wide">
                    Chart Preferences
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="defaultChartType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Default Chart Type
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-chart-type" className="bg-input border-border font-mono">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="line">Line Chart</SelectItem>
                              <SelectItem value="candlestick">Candlestick (Recommended)</SelectItem>
                              <SelectItem value="area">Area Chart</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="defaultTimeframe"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Default Timeframe
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timeframe" className="bg-input border-border font-mono">
                                <SelectValue placeholder="Select timeframe" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="1D">1 Day (Recommended)</SelectItem>
                              <SelectItem value="5D">5 Days</SelectItem>
                              <SelectItem value="1M">1 Month</SelectItem>
                              <SelectItem value="3M">3 Months</SelectItem>
                              <SelectItem value="1Y">1 Year</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="showVolume"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                              Show Volume
                            </FormLabel>
                            <div className="text-xs text-muted-foreground font-mono">
                              Display volume bars on charts
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-show-volume"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="showIndicators"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                              Technical Indicators
                            </FormLabel>
                            <div className="text-xs text-muted-foreground font-mono">
                              Show moving averages and indicators
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-show-indicators"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator className="border-card-border" />

              {/* Notification Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-mono font-semibold text-primary uppercase tracking-wide">
                    Notification Settings
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="browserNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                              Browser Notifications
                            </FormLabel>
                            <div className="text-xs text-muted-foreground font-mono">
                              Show desktop notifications
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-browser-notifications"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                              Email Notifications
                            </FormLabel>
                            <div className="text-xs text-muted-foreground font-mono">
                              Send alert emails
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-email-notifications"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="alertSounds"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                              Alert Sounds
                            </FormLabel>
                            <div className="text-xs text-muted-foreground font-mono">
                              Play audio for alerts
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-alert-sounds"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="soundEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-md border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                              General Sounds
                            </FormLabel>
                            <div className="text-xs text-muted-foreground font-mono">
                              Enable interface sounds
                            </div>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-sound-enabled"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </div>

              <Separator className="border-card-border" />

              {/* Trading Settings */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" />
                  <h3 className="text-lg font-mono font-semibold text-primary uppercase tracking-wide">
                    Trading Settings
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="tradingHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                          Market Hours Display
                        </FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-trading-hours" className="bg-input border-border font-mono">
                              <SelectValue placeholder="Select market hours" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-card border-border">
                            <SelectItem value="market">Market Hours Only (Recommended)</SelectItem>
                            <SelectItem value="extended">Extended Hours</SelectItem>
                            <SelectItem value="24h">24-Hour Global Markets</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground font-mono">
                          Controls which market data to display based on trading hours
                        </div>
                        <FormMessage className="text-destructive text-xs font-mono" />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </form>
          </Form>
        </div>

        <div className="border-t border-card-border pt-4 flex items-center justify-between">
          <Button
            data-testid="button-reset-defaults"
            type="button"
            variant="outline"
            className="font-mono"
            onClick={resetToDefaults}
            disabled={isLoading}
          >
            Reset to Defaults
          </Button>

          <div className="flex items-center gap-2">
            <Button
              data-testid="button-cancel-settings"
              type="button"
              variant="ghost"
              className="font-mono"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              data-testid="button-save-settings"
              type="submit"
              className="font-mono"
              onClick={form.handleSubmit(onSubmit)}
              disabled={isLoading}
            >
              {isLoading ? "Saving..." : "Save Preferences"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}