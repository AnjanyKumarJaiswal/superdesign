import { useState, useEffect } from "react";
import { Figma, Loader2 } from "lucide-react";
import { isAuthenticated, logout, clearAuth } from "../utils/auth";

// API URL from environment or default
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const LoginButton = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(isAuthenticated());

  // Check authentication status periodically
  useEffect(() => {
    const checkAuth = () => {
      const authStatus = isAuthenticated();
      setAuthenticated(authStatus);
    };
    
    // Check on mount
    checkAuth();
    
    // Set up interval to check
    const interval = setInterval(checkAuth, 60000); // Check every minute
    
    return () => clearInterval(interval);
  }, []);

  const generateStateParam = () => {
    // Generate a random state parameter for CSRF protection
    const randomState = Math.random().toString(36).substring(2, 15);
    // Store in sessionStorage for verification after redirect
    sessionStorage.setItem('oauth_state', randomState);
    return randomState;
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      // Clear any existing auth data to prevent using stale tokens
      clearAuth();
      
      // Generate state parameter for CSRF protection
      const state = generateStateParam();
      
      // Redirect to OAuth authorization with state parameter
      const authUrl = `${API_URL}/auth/figma?state=${state}`;
      console.log(`Redirecting to auth URL: ${authUrl}`);
      
      window.location.href = authUrl;
    } catch (error) {
      console.error("Login error:", error);
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
  };

  if (authenticated) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl">
          <Figma className="w-4 h-4 text-purple-400" />
          <span className="text-white text-sm font-medium">Connected</span>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl text-white text-sm font-medium transition-all"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      disabled={isLoading}
      className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-400/40 hover:border-purple-400/60 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
      style={{ fontFamily: "'Geist Mono', monospace" }}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Connecting...</span>
        </>
      ) : (
        <>
          <Figma className="w-5 h-5" />
          <span>Login with Figma</span>
        </>
      )}
    </button>
  );
};

export default LoginButton;
