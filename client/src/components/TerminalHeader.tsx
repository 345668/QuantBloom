import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Settings, Bell, User, LogOut, LogIn } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AuthManager from "@/components/auth/AuthManager";
import ProfileDialog from "@/components/auth/ProfileDialog";
import NotificationsPanel from "@/components/auth/NotificationsPanel";
import SettingsPanel from "@/components/auth/SettingsPanel";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface TerminalHeaderProps {
  onSymbolSearch?: (symbol: string) => void;
}

export default function TerminalHeader({ onSymbolSearch }: TerminalHeaderProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAuth, setShowAuth] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const { user, isAuthenticated, isLoading, login, logout } = useAuth();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onSymbolSearch?.(searchTerm.toUpperCase());
      setSearchTerm("");
    }
  };

  const handleLoginClick = () => {
    setAuthMode('login');
    setShowAuth(true);
  };

  const handleSignupClick = () => {
    setAuthMode('signup');
    setShowAuth(true);
  };

  const handleLogoutClick = async () => {
    await logout();
  };

  const handleAuthSuccess = (authUser: any) => {
    login(authUser);
    setShowAuth(false);
  };

  const handleProfileClick = () => {
    setShowProfile(true);
  };

  const handleSettingsClick = () => {
    setShowSettings(true);
  };

  const marketStatus = "OPEN"; // todo: remove mock functionality
  const currentTime = new Date().toLocaleTimeString();

  return (
    <>
      <div className="bg-card border-b border-card-border px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-primary font-bold text-lg font-mono tracking-wide">
            BLOOM TERMINAL
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            <span className="w-2 h-2 bg-chart-2 rounded-full mr-1"></span>
            {marketStatus}
          </Badge>
          <div className="text-sm text-muted-foreground font-mono">
            {currentTime}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-symbol-search"
                type="text"
                placeholder="Enter symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-32 h-8 bg-input border-border text-sm font-mono uppercase"
              />
            </div>
            <Button 
              data-testid="button-search"
              type="submit" 
              size="sm" 
              variant="outline"
              className="h-8 font-mono"
            >
              GO
            </Button>
          </form>
          
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <NotificationsPanel>
                <Button 
                  data-testid="button-notifications" 
                  size="icon" 
                  variant="ghost" 
                  className="h-8 w-8"
                >
                  <Bell className="w-4 h-4" />
                </Button>
              </NotificationsPanel>
            )}
            
            {isAuthenticated && (
              <Button 
                data-testid="button-settings" 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8"
                onClick={handleSettingsClick}
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}

            {isLoading ? (
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled>
                <User className="w-4 h-4 opacity-50" />
              </Button>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    data-testid="button-user-menu" 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8"
                  >
                    <User className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-card border-border">
                  <DropdownMenuLabel className="font-mono">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm text-primary font-bold">
                        {user?.profile?.firstName && user?.profile?.lastName
                          ? `${user.profile.firstName} ${user.profile.lastName}`
                          : user?.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{user?.username}
                      </p>
                      {user?.profile?.email && (
                        <p className="text-xs text-muted-foreground">
                          {user.profile.email}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    data-testid="menu-profile"
                    className="font-mono cursor-pointer"
                    onClick={handleProfileClick}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    data-testid="menu-preferences"
                    className="font-mono cursor-pointer"
                    onClick={handleSettingsClick}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Terminal Preferences
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    data-testid="menu-logout"
                    className="font-mono cursor-pointer text-destructive focus:text-destructive"
                    onClick={handleLogoutClick}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-1">
                <Button 
                  data-testid="button-signup"
                  size="sm" 
                  variant="outline" 
                  className="h-8 font-mono text-xs"
                  onClick={handleSignupClick}
                >
                  SIGNUP
                </Button>
                <Button 
                  data-testid="button-login"
                  size="sm" 
                  variant="default" 
                  className="h-8 font-mono text-xs"
                  onClick={handleLoginClick}
                >
                  <LogIn className="w-3 h-3 mr-1" />
                  LOGIN
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthManager
        open={showAuth}
        onOpenChange={setShowAuth}
        initialMode={authMode}
        onAuthSuccess={handleAuthSuccess}
      />

      <ProfileDialog
        open={showProfile}
        onOpenChange={setShowProfile}
      />

      <SettingsPanel
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </>
  );
}