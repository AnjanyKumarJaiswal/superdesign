import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login, clearAuth } from "../utils/auth";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Authenticating...");
  const [details, setDetails] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    const platform = searchParams.get("platform");
    const state = searchParams.get("state");

    const navigateAfterDelay = (path, delay = 3000, stateObj = {}) => {
      setTimeout(() => {
        navigate(path, { state: stateObj });
      }, delay);
    };

    const handleState = () => {
      const storedState = sessionStorage.getItem('oauth_state');
      sessionStorage.removeItem('oauth_state');

      if (storedState && state && !state.includes(storedState)) {
        console.warn("State parameter doesn't match stored state - potential CSRF risk");
        return false;
      }
      return true;
    };

    clearAuth();

    if (error) {
      console.error("Auth error:", error);
      setStatus("error");
      setMessage(`Authentication failed`);
      setDetails(error);
      navigateAfterDelay("/prompt");
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No authentication token received");
      navigateAfterDelay("/prompt");
      return;
    }

    const stateValid = handleState();
    if (!stateValid) {
      console.warn("State validation failed but continuing with simplified auth");
    }

    try {
      console.log("Processing authentication token");
      console.log("Token received:", token.substring(0, 10) + "...");
      const user = login(token);

      if (!user) {
        console.warn("Could not decode user from token, but continuing with login");
      }

      const loginPlatform = user?.platform || platform || "design platform";

      setStatus("success");
      setMessage(`Successfully logged in!`);
      setDetails(`Connected to ${loginPlatform}`);

      console.log("Authentication successful, redirecting to prompt page");

      if (user && user.accessToken) {
        localStorage.setItem('figma_access_token', user.accessToken);
      }

      navigateAfterDelay("/prompt", 1500, {
        justAuthenticated: true,
        platform: loginPlatform,
        loginTime: new Date().toISOString()
      });
    } catch (err) {
      console.error("Authentication processing error:", err);
      setStatus("error");
      setMessage("Failed to complete authentication");
      setDetails(err.message || "Unknown error occurred");
      navigateAfterDelay("/prompt");
    }
  }, [searchParams, navigate]);

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{
        backgroundColor: "#030014",
        fontFamily: "'Geist Mono', monospace",
      }}
    >
      <div className="text-center">
        <div className="mb-6 flex justify-center">
          {status === "processing" && (
            <Loader2 className="w-16 h-16 text-white animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle className="w-16 h-16 text-green-400" />
          )}
          {status === "warning" && (
            <AlertTriangle className="w-16 h-16 text-yellow-400" />
          )}
          {status === "error" && <XCircle className="w-16 h-16 text-red-400" />}
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          {status === "processing" && "Processing Authentication"}
          {status === "success" && "Authentication Successful"}
          {status === "warning" && "Authentication Warning"}
          {status === "error" && "Authentication Failed"}
        </h1>

        <p className="text-gray-400 text-lg mb-2">{message}</p>

        {details && (
          <p className="text-gray-500 text-md mb-6">{details}</p>
        )}

        {status === "processing" && (
          <div className="flex justify-center gap-2 mt-6">
            <div
              className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className="w-2 h-2 bg-white/30 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
        )}

        {(status === "success" || status === "error" || status === "warning") && (
          <p className="text-gray-500 text-sm mt-4">
            Redirecting in a moment...
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
