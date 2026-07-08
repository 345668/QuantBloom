import { createContext, useContext, useState, useEffect } from "react";
import { AuthUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (user: AuthUser) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (updates: Partial<AuthUser['profile']>) => Promise<void>;
  updatePreferences: (updates: Partial<AuthUser['preferences']>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = 'bloom_terminal_user';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const isAuthenticated = !!user;

  // Check for active session on app start
  useEffect(() => {
    const loadStoredUser = async () => {
      try {
        // First, check if there's an active session on the server
        const response = await fetch('/api/auth/profile');
        if (response.ok) {
          const sessionUser = await response.json();
          setUser(sessionUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionUser));
        } else {
          // No active session, clear any stale localStorage data
          const storedUser = localStorage.getItem(STORAGE_KEY);
          if (storedUser) {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (error) {
        console.warn('Failed to check session, clearing local data:', error);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredUser();
  }, []);

  const login = (authUser: AuthUser) => {
    setUser(authUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
    toast({
      title: "Welcome to Bloom Terminal",
      description: `Welcome back, ${authUser.profile?.firstName || authUser.username}!`,
      duration: 3000,
    });
  };

  const logout = async () => {
    try {
      // Call the server logout endpoint to destroy the session
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.warn('Failed to logout on server:', error);
      // Continue with local logout even if server logout fails
    } finally {
      // Always clear local state and storage
      setUser(null);
      localStorage.removeItem(STORAGE_KEY);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
        duration: 3000,
      });
    }
  };

  const refreshUser = async () => {
    try {
      const response = await fetch('/api/auth/profile');
      if (response.ok) {
        const freshUser = await response.json();
        setUser(freshUser);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(freshUser));
      } else if (response.status === 401) {
        // Session expired or not authenticated
        logout();
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      toast({
        title: "Connection Error",
        description: "Failed to refresh user data. Please check your connection.",
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const updateProfile = async (updates: Partial<AuthUser['profile']>) => {
    if (!user) throw new Error('No user logged in');

    try {
      const response = await fetch(`/api/auth/profile/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update profile');
      }

      const result = await response.json();
      
      // Update the user state with the new profile data
      const updatedUser = {
        ...user,
        profile: {
          ...user.profile,
          ...result.profile
        }
      };
      
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      
      toast({
        title: "Profile Updated",
        description: "Your profile has been successfully updated.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
        duration: 5000,
      });
      throw error;
    }
  };

  const updatePreferences = async (updates: Partial<AuthUser['preferences']>) => {
    if (!user) throw new Error('No user logged in');

    try {
      const response = await fetch(`/api/auth/preferences/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update preferences');
      }

      const result = await response.json();
      
      // Update the user state with the new preferences data
      const updatedUser = {
        ...user,
        preferences: {
          ...user.preferences,
          ...result.preferences
        }
      };
      
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      
      toast({
        title: "Preferences Updated",
        description: "Your terminal preferences have been successfully updated.",
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update preferences",
        variant: "destructive",
        duration: 5000,
      });
      throw error;
    }
  };

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refreshUser,
    updateProfile,
    updatePreferences,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}