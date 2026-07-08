import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AlertCircle, CheckCircle2, User, Settings, Save } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { AuthUser } from "@shared/schema";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  company: z.string().max(200).optional().or(z.literal("")),
  jobTitle: z.string().max(200).optional().or(z.literal("")),
  phone: z.string().min(10, "Phone must be at least 10 digits").max(20).optional().or(z.literal("")),
  timezone: z.string().max(50).optional().or(z.literal("")),
  dateFormat: z.string().max(20).optional().or(z.literal(""))
});

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

type ProfileFormData = z.infer<typeof profileSchema>;
type PreferencesFormData = z.infer<typeof preferencesSchema>;

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const { user, updateProfile, updatePreferences } = useAuth();
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isPreferencesSaving, setIsPreferencesSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [preferencesError, setPreferencesError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [preferencesSuccess, setPreferencesSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("profile");

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: user?.profile?.firstName || "",
      lastName: user?.profile?.lastName || "",
      email: user?.profile?.email || "",
      company: user?.profile?.company || "",
      jobTitle: user?.profile?.jobTitle || "",
      phone: user?.profile?.phone || "",
      timezone: user?.profile?.timezone || "",
      dateFormat: user?.profile?.dateFormat || ""
    }
  });

  const preferencesForm = useForm<PreferencesFormData>({
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

  const onProfileSubmit = async (data: ProfileFormData) => {
    setIsProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      // Filter out empty strings for optional fields
      const updates = {
        ...data,
        email: data.email || undefined,
        company: data.company || undefined,
        jobTitle: data.jobTitle || undefined,
        phone: data.phone || undefined,
        timezone: data.timezone || undefined,
        dateFormat: data.dateFormat || undefined
      };

      await updateProfile(updates);
      setProfileSuccess("Profile updated successfully!");
      
      setTimeout(() => {
        setProfileSuccess(null);
      }, 3000);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const onPreferencesSubmit = async (data: PreferencesFormData) => {
    setIsPreferencesSaving(true);
    setPreferencesError(null);
    setPreferencesSuccess(null);

    try {
      await updatePreferences(data);
      setPreferencesSuccess("Preferences updated successfully!");
      
      setTimeout(() => {
        setPreferencesSuccess(null);
      }, 3000);
    } catch (err) {
      setPreferencesError(err instanceof Error ? err.message : 'Failed to update preferences');
    } finally {
      setIsPreferencesSaving(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-4xl bg-card border-card-border max-h-[90vh] overflow-y-auto"
        data-testid="dialog-profile"
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-primary text-xl font-bold text-center font-mono tracking-wide">
            PROFILE & PREFERENCES
          </DialogTitle>
          <div className="w-full h-px bg-primary opacity-30"></div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-muted">
            <TabsTrigger 
              value="profile" 
              className="font-mono text-xs uppercase tracking-wider"
              data-testid="tab-profile"
            >
              <User className="w-4 h-4 mr-2" />
              Personal Info
            </TabsTrigger>
            <TabsTrigger 
              value="preferences" 
              className="font-mono text-xs uppercase tracking-wider"
              data-testid="tab-preferences"
            >
              <Settings className="w-4 h-4 mr-2" />
              Terminal Settings
            </TabsTrigger>
          </TabsList>

          {/* Personal Information Tab */}
          <TabsContent value="profile" className="space-y-6 mt-6">
            <Form {...profileForm}>
              <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                {profileError && (
                  <div 
                    className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                    data-testid="profile-error-message"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive font-mono">{profileError}</span>
                  </div>
                )}

                {profileSuccess && (
                  <div 
                    className="flex items-center gap-2 p-3 bg-chart-2/10 border border-chart-2/20 rounded-md"
                    data-testid="profile-success-message"
                  >
                    <CheckCircle2 className="h-4 w-4 text-chart-2" />
                    <span className="text-sm text-chart-2 font-mono">{profileSuccess}</span>
                  </div>
                )}

                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                    Basic Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            First Name *
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-first-name"
                              placeholder="First name..."
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              disabled={isProfileSaving}
                            />
                          </FormControl>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Last Name *
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-last-name"
                              placeholder="Last name..."
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              disabled={isProfileSaving}
                            />
                          </FormControl>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                          Email Address
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            data-testid="input-email"
                            type="email"
                            placeholder="trader@example.com"
                            className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                            disabled={isProfileSaving}
                          />
                        </FormControl>
                        <FormMessage className="text-destructive text-xs font-mono" />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Professional Information */}
                <div className="space-y-4">
                  <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                    Professional Information
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="company"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Company
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-company"
                              placeholder="Investment firm..."
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              disabled={isProfileSaving}
                            />
                          </FormControl>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="jobTitle"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Job Title
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-job-title"
                              placeholder="Portfolio Manager..."
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              disabled={isProfileSaving}
                            />
                          </FormControl>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={profileForm.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Phone Number
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-phone"
                              placeholder="+1 (555) 123-4567"
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              disabled={isProfileSaving}
                            />
                          </FormControl>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={profileForm.control}
                      name="timezone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Timezone
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-timezone"
                              placeholder="America/New_York"
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              disabled={isProfileSaving}
                            />
                          </FormControl>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    data-testid="button-save-profile"
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold tracking-wide min-w-32"
                    disabled={isProfileSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isProfileSaving ? "SAVING..." : "SAVE PROFILE"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>

          {/* Terminal Preferences Tab */}
          <TabsContent value="preferences" className="space-y-6 mt-6">
            <Form {...preferencesForm}>
              <form onSubmit={preferencesForm.handleSubmit(onPreferencesSubmit)} className="space-y-6">
                {preferencesError && (
                  <div 
                    className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                    data-testid="preferences-error-message"
                  >
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive font-mono">{preferencesError}</span>
                  </div>
                )}

                {preferencesSuccess && (
                  <div 
                    className="flex items-center gap-2 p-3 bg-chart-2/10 border border-chart-2/20 rounded-md"
                    data-testid="preferences-success-message"
                  >
                    <CheckCircle2 className="h-4 w-4 text-chart-2" />
                    <span className="text-sm text-chart-2 font-mono">{preferencesSuccess}</span>
                  </div>
                )}

                {/* Display & Layout */}
                <div className="space-y-4">
                  <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                    Display & Layout
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={preferencesForm.control}
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
                              <SelectItem value="grid">Grid View</SelectItem>
                              <SelectItem value="single">Single Panel</SelectItem>
                              <SelectItem value="tabs">Tabbed View</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
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
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="auto">Auto</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
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
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Data & Refresh */}
                <div className="space-y-4">
                  <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                    Data & Refresh Settings
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={preferencesForm.control}
                      name="enableRealTimeData"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Real-time Data</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Enable live market data updates
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              data-testid="switch-real-time"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
                      name="autoRefreshInterval"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Auto Refresh (seconds)
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              data-testid="input-refresh-interval"
                              type="number"
                              min="5"
                              max="300"
                              className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                              onChange={(e) => field.onChange(parseInt(e.target.value))}
                            />
                          </FormControl>
                          <FormDescription className="text-xs font-mono text-muted-foreground">
                            Refresh interval between 5-300 seconds
                          </FormDescription>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Chart Settings */}
                <div className="space-y-4">
                  <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                    Chart Settings
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={preferencesForm.control}
                      name="defaultChartType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Chart Type
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-chart-type" className="bg-input border-border font-mono">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="line">Line</SelectItem>
                              <SelectItem value="candlestick">Candlestick</SelectItem>
                              <SelectItem value="area">Area</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={preferencesForm.control}
                      name="defaultTimeframe"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Timeframe
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-timeframe" className="bg-input border-border font-mono">
                                <SelectValue placeholder="Select timeframe" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="1D">1 Day</SelectItem>
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

                    <FormField
                      control={preferencesForm.control}
                      name="tradingHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                            Trading Hours
                          </FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-trading-hours" className="bg-input border-border font-mono">
                                <SelectValue placeholder="Select hours" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-card border-border">
                              <SelectItem value="market">Market Hours</SelectItem>
                              <SelectItem value="extended">Extended Hours</SelectItem>
                              <SelectItem value="24h">24 Hours</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-destructive text-xs font-mono" />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={preferencesForm.control}
                      name="showVolume"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Show Volume</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Display volume data on charts
                            </FormDescription>
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
                      control={preferencesForm.control}
                      name="showIndicators"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Show Indicators</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Display technical indicators
                            </FormDescription>
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

                {/* Notifications */}
                <div className="space-y-4">
                  <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                    Notifications & Alerts
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField
                      control={preferencesForm.control}
                      name="browserNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Browser Notifications</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Show desktop notifications
                            </FormDescription>
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
                      control={preferencesForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Email Notifications</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Send notifications via email
                            </FormDescription>
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

                    <FormField
                      control={preferencesForm.control}
                      name="alertSounds"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Alert Sounds</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Play sound for alerts
                            </FormDescription>
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
                      control={preferencesForm.control}
                      name="soundEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base font-mono">Sound Effects</FormLabel>
                            <FormDescription className="text-xs font-mono text-muted-foreground">
                              Enable terminal sound effects
                            </FormDescription>
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

                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    data-testid="button-save-preferences"
                    type="submit"
                    className="bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold tracking-wide min-w-32"
                    disabled={isPreferencesSaving}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isPreferencesSaving ? "SAVING..." : "SAVE PREFERENCES"}
                  </Button>
                </div>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}