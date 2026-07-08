import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const loginSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters").max(100)
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoginSuccess: (user: any) => void;
  onSwitchToSignup: () => void;
}

export default function LoginDialog({ 
  open, 
  onOpenChange, 
  onLoginSuccess,
  onSwitchToSignup 
}: LoginDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: ""
    }
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      onLoginSuccess(result.user);
      onOpenChange(false);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    form.setValue('username', 'demo');
    form.setValue('password', 'demo');
    await onSubmit({ username: 'demo', password: 'demo' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-md bg-card border-card-border"
        data-testid="dialog-login"
      >
        <DialogHeader className="space-y-3">
          <DialogTitle className="text-primary text-xl font-bold text-center font-mono tracking-wide">
            BLOOM TERMINAL LOGIN
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

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                    Username
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      data-testid="input-username"
                      placeholder="Enter username..."
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
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-secondary-foreground font-mono text-xs uppercase tracking-wider">
                    Password
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        data-testid="input-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password..."
                        className="bg-input border-border text-foreground font-mono placeholder:text-muted-foreground focus:border-primary pr-10"
                        disabled={isLoading}
                      />
                      <Button
                        data-testid="button-toggle-password"
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

            <div className="flex flex-col gap-2 pt-2">
              <Button
                data-testid="button-login"
                type="submit"
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-mono font-bold tracking-wide"
                disabled={isLoading}
              >
                {isLoading ? "CONNECTING..." : "LOGIN"}
              </Button>

              <Button
                data-testid="button-demo-login"
                type="button"
                variant="outline"
                className="w-full border-border text-foreground hover:bg-accent hover:text-accent-foreground font-mono"
                onClick={handleDemoLogin}
                disabled={isLoading}
              >
                DEMO LOGIN
              </Button>
            </div>

            <div className="text-center pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground font-mono">
                Don't have an account?{' '}
                <Button
                  data-testid="button-switch-signup"
                  type="button"
                  variant="link"
                  className="p-0 h-auto text-primary hover:text-primary/80 font-mono underline"
                  onClick={onSwitchToSignup}
                  disabled={isLoading}
                >
                  Create Account
                </Button>
              </p>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}