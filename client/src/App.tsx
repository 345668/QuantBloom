import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DirectionProvider } from "@radix-ui/react-direction";
import { AuthProvider } from "@/contexts/AuthContext";
import { TerminalProvider } from "@/contexts/TerminalContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home}/>
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DirectionProvider dir="ltr">
        <TooltipProvider>
          <AuthProvider>
            <TerminalProvider>
              <Toaster />
              <Router />
            </TerminalProvider>
          </AuthProvider>
        </TooltipProvider>
      </DirectionProvider>
    </QueryClientProvider>
  );
}

export default App;
