import { useState } from "react";
import { trpc } from "../utils/trpc";
import { isAuthenticated, getCurrentUser } from "../utils/auth";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

const DesignGenerator = ({ prompt, fileId, platform = "figma" }) => {
  const [taskId, setTaskId] = useState(null);
  const authenticated = isAuthenticated();
  const user = getCurrentUser();

  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("Design generation started:", data);
      setTaskId(data.taskId);
    },
    onError: (error) => {
      console.error("Design generation failed:", error);
      if (error.message.includes("Unauthorized")) {
        alert("Please log in with Figma to generate designs");
      }
    },
  });

  const jobStatus = trpc.getJobStatus.useQuery(
    { jobId: taskId },
    {
      enabled: !!taskId,
      refetchInterval: 2000,
    }
  );

  const handleGenerate = async () => {
    if (!authenticated) {
      alert("Please log in with Figma first");
      return;
    }

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

      {taskId && jobStatus.data && (
        <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center gap-3">
            {jobStatus.data.status === "running" && (
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            )}
            {jobStatus.data.status === "completed" && (
              <CheckCircle className="w-5 h-5 text-green-400" />
            )}
            {jobStatus.data.status === "failed" && (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            <div className="flex-1">
              <p className="text-white text-sm font-medium">
                Status: {jobStatus.data.status}
              </p>
              {jobStatus.data.result?.message && (
                <p className="text-gray-400 text-xs mt-1">
                  {jobStatus.data.result.message}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/10">
            <p className="text-gray-500 text-xs">
              Task ID: <span className="text-gray-400">{taskId}</span>
            </p>
          </div>
        </div>
      )}

      {jobStatus.data?.status === "completed" && (
        <div className="flex items-start gap-3 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl">
          <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-green-300 text-sm font-medium">
              Design Generated Successfully!
            </p>
            <p className="text-green-400 text-xs mt-1">
              Check your {platform} file to see the results.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DesignGenerator;
