import { useState } from "react";
import LoginDialog from "./LoginDialog";
import SignupDialog from "./SignupDialog";
import { AuthUser } from "@shared/schema";

type AuthMode = 'login' | 'signup';

interface AuthManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialMode?: AuthMode;
  onAuthSuccess: (user: AuthUser) => void;
}

export default function AuthManager({ 
  open, 
  onOpenChange, 
  initialMode = 'login',
  onAuthSuccess 
}: AuthManagerProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);

  const handleLoginSuccess = (user: AuthUser) => {
    onAuthSuccess(user);
  };

  const handleSignupSuccess = (user: AuthUser) => {
    onAuthSuccess(user);
  };

  const switchToSignup = () => {
    setMode('signup');
  };

  const switchToLogin = () => {
    setMode('login');
  };

  return (
    <>
      <LoginDialog
        open={open && mode === 'login'}
        onOpenChange={onOpenChange}
        onLoginSuccess={handleLoginSuccess}
        onSwitchToSignup={switchToSignup}
      />
      
      <SignupDialog
        open={open && mode === 'signup'}
        onOpenChange={onOpenChange}
        onSignupSuccess={handleSignupSuccess}
        onSwitchToLogin={switchToLogin}
      />
    </>
  );
}