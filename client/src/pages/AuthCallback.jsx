import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login } from "../utils/auth";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("processing"); // processing, success, error
  const [message, setMessage] = useState("Authenticating...");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    const platform = searchParams.get("platform");

    if (error) {
      setStatus("error");
      setMessage(`Authentication failed: ${error}`);
      setTimeout(() => {
        navigate("/prompt");
      }, 3000);
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("No authentication token received");
      setTimeout(() => {
        navigate("/prompt");
      }, 3000);
      return;
    }

    try {
      // Save token and decode user data
      const user = login(token);

      if (!user) {
        throw new Error("Failed to decode user token");
      }

      setStatus("success");
      setMessage(`Successfully logged in with ${platform || user.platform}!`);

      // Redirect to prompt page after successful login
      setTimeout(() => {
        navigate("/prompt", {
          state: { justAuthenticated: true, platform: user.platform },
        });
      }, 1500);
    } catch (err) {
      console.error("Authentication error:", err);
      setStatus("error");
      setMessage("Failed to complete authentication");
      setTimeout(() => {
        navigate("/prompt");
      }, 3000);
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
        {/* Status Icon */}
        <div className="mb-6 flex justify-center">
          {status === "processing" && (
            <Loader2 className="w-16 h-16 text-white animate-spin" />
          )}
          {status === "success" && (
            <CheckCircle className="w-16 h-16 text-green-400" />
          )}
          {status === "error" && <XCircle className="w-16 h-16 text-red-400" />}
        </div>

        {/* Message */}
        <h1 className="text-2xl font-bold text-white mb-4">
          {status === "processing" && "Processing Authentication"}
          {status === "success" && "Authentication Successful"}
          {status === "error" && "Authentication Failed"}
        </h1>

        <p className="text-gray-400 text-lg mb-8">{message}</p>

        {/* Loading Indicator */}
        {status === "processing" && (
          <div className="flex justify-center gap-2">
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

        {/* Redirect message */}
        {(status === "success" || status === "error") && (
          <p className="text-gray-500 text-sm mt-4">
            Redirecting in a moment...
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
