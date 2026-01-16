import { useState } from "react";
import { trpc } from "../utils/trpc";
import { isAuthenticated, getCurrentUser } from "../utils/auth";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

const DesignGenerator = ({ prompt, fileId, platform = "figma" }) => {
  const [result, setResult] = useState(null);
  const authenticated = isAuthenticated();
  const user = getCurrentUser();

  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("Design generation completed:", data);
      setResult(data);
    },
    onError: (error) => {
      console.error("Design generation failed:", error);
      if (error.message.includes("Unauthorized")) {
        alert("Please log in with Figma to generate designs");
      }
    },
  });

  const handleGenerate = async () => {
    if (!authenticated) {
      alert("Please log in with Figma first");
      return;
    }

    setResult(null);

    generateDesign.mutate({
      prompt,
      fileId,
      platform,
    });
  };

  if (!authenticated) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <AlertCircle className="w-5 h-5 text-yellow-400" />
        <p className="text-yellow-300 text-sm">
          Please log in with Figma to generate designs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <span>Logged in as:</span>
        <span className="text-white font-medium">{user?.platform} user</span>
      </div>

      <button
        onClick={handleGenerate}
        disabled={generateDesign.isLoading}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-400/40 hover:border-purple-400/60 rounded-xl text-white font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {generateDesign.isLoading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Generating Design...</span>
          </>
        ) : (
          <span>Generate Design</span>
        )}
      </button>

      {generateDesign.error && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-red-300 text-sm font-medium">
              Generation Failed
            </p>
            <p className="text-red-400 text-xs mt-1">
              {generateDesign.error.message}
            </p>
          </div>
        </div>
      )}

      {result && (
        <div className="flex items-start gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-300 text-sm font-medium">
              Design Generated Successfully!
            </p>
            <p className="text-green-400 text-xs mt-1">
              {result.result || "Check your Figma file to see the results."}
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Task ID: {result.taskId} • Executed {result.executedSteps} steps
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignGenerator;
