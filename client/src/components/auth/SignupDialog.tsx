import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const signupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters").max(100),
  confirmPassword: z.string().min(6, "Please confirm your password"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  firstName: z.string().min(1, "First name is required").max(100).optional().or(z.literal("")),
  lastName: z.string().min(1, "Last name is required").max(100).optional().or(z.literal(""))
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupFormData = z.infer<typeof signupSchema>;

interface SignupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignupSuccess: (user: any) => void;
  onSwitchToLogin: () => void;
}

export default function SignupDialog({ 
  open, 
  onOpenChange, 
  onSignupSuccess,
  onSwitchToLogin 
}: SignupDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const form = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      email: "",
      firstName: "",
      lastName: ""
    }
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const { confirmPassword, ...signupData } = data;
      
      // Only send non-empty optional fields
      const payload = {
        username: signupData.username,
        password: signupData.password,
        ...(signupData.email && { email: signupData.email }),
        ...(signupData.firstName && { firstName: signupData.firstName }),
        ...(signupData.lastName && { lastName: signupData.lastName })
      };

      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Signup failed');
      }

      setSuccess(result.message || 'Account created successfully!');
      setTimeout(() => {
        onSignupSuccess(result.user);
        onOpenChange(false);
        form.reset();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-lg bg-card border-card-border max-h-[90vh] overflow-y-auto"
        data-testid="dialog-signup"
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-primary text-xl font-bold text-center font-mono tracking-wide">
            CREATE BLOOM ACCOUNT
          </DialogTitle>
          <div className="w-full h-px bg-primary opacity-30"></div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div 
                className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                data-testid="error-message"
              >
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive font-mono">{error}</span>
              </div>
            )}

            {success && (
              <div 
                className="flex items-center gap-2 p-3 bg-chart-2/10 border border-chart-2/20 rounded-md"
                data-testid="success-message"
              >
                <CheckCircle2 className="h-4 w-4 text-chart-2" />
                <span className="text-sm text-chart-2 font-mono">{success}</span>
              </div>
            )}

            {/* Required Fields */}
            <div className="space-y-4">
              <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                Required Information
              </h3>

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                      Username *
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-signup-username"
                        placeholder="Choose a unique username..."
                        className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage className="text-destructive text-xs font-mono" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                        Password *
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            data-testid="input-signup-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Min 6 characters..."
                            className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary pr-10"
                            disabled={isLoading}
                          />
                          <Button
                            data-testid="button-toggle-signup-password"
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-destructive text-xs font-mono" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                        Confirm Password *
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            data-testid="input-signup-confirm-password"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Repeat password..."
                            className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary pr-10"
                            disabled={isLoading}
                          />
                          <Button
                            data-testid="button-toggle-confirm-password"
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-destructive text-xs font-mono" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Optional Fields */}
            <div className="space-y-4">
              <h3 className="text-foreground font-mono text-sm uppercase tracking-wider border-b border-border pb-2">
                Profile Information (Optional)
              </h3>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-signup-email"
                        type="email"
                        placeholder="trader@example.com"
                        className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <FormMessage className="text-destructive text-xs font-mono" />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                        First Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-signup-first-name"
                          placeholder="John"
                          className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-destructive text-xs font-mono" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                        Last Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          data-testid="input-signup-last-name"
                          placeholder="Trader"
                          className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary"
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage className="text-destructive text-xs font-mono" />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button
                data-testid="button-signup"
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold tracking-wide"
                disabled={isLoading}
              >
                {isLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
              </Button>
            </div>

            <div className="text-center pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground font-mono">
                Already have an account?{' '}
                <Button
                  data-testid="button-switch-login"
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-primary hover:text-primary/80 font-mono underline"
                  onClick={onSwitchToLogin}
                  disabled={isLoading}
                >
                  Sign In
                </Button>
              </p>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}