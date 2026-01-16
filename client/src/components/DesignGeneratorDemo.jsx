import { useState } from "react";
import { trpc } from "../utils/trpc";
import { isAuthenticated, getCurrentUser } from "../utils/auth";
import { Loader2, AlertCircle, CheckCircle, Figma, Sparkles } from "lucide-react";
import LoginButton from "./LoginButton";

const DesignGeneratorDemo = () => {
  const authenticated = isAuthenticated();
  const user = getCurrentUser();
  const [prompt, setPrompt] = useState("");
  const [fileId, setFileId] = useState("");
  const [result, setResult] = useState(null);

  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("✅ Design generation completed:", data);
      setResult(data);
      alert(`Design generation completed! Task ID: ${data.taskId}`);
    },
    onError: (error) => {
      console.error("❌ Design generation failed:", error);
      if (error.message.includes("Unauthorized")) {
        alert("Please log in with Figma first!");
      } else {
        alert(`Error: ${error.message}`);
      }
    },
  });

  const handleGenerate = () => {
    if (!authenticated) {
      alert("Please log in with Figma first!");
      return;
    }

    if (!fileId) {
      alert("Please enter a Figma File ID");
      return;
    }

    if (!prompt) {
      alert("Please enter a prompt");
      return;
    }

    generateDesign.mutate({
      prompt,
      fileId,
      platform: "figma"
    });
  };

  return (
    <div className="p-8 max-w-2xl mx-auto bg-black border border-white/10 rounded-2xl text-white">
      <div className="flex items-center gap-3 mb-6">
        <Sparkles className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold">Design Generator Demo</h2>
      </div>

      <div className="mb-8 p-4 bg-white/5 rounded-xl border border-white/10">
        <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Authentication Status</h3>

        {authenticated ? (
          <div className="flex items-center gap-3 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span>Authenticated as {user?.platform} user</span>
            <button
              onClick={() => {
                sessionStorage.removeItem("superdesign_token");
                window.location.reload();
              }}
              className="ml-auto text-xs text-gray-400 hover:text-white underline"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 text-yellow-400">
              <AlertCircle className="w-5 h-5" />
              <span>Not authenticated</span>
            </div>
            <LoginButton />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Figma File ID
          </label>
          <input
            type="text"
            value={fileId}
            onChange={(e) => setFileId(e.target.value)}
            placeholder="e.g. 12345abcdef"
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what you want to generate..."
            rows={4}
            className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-purple-400"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={generateDesign.isLoading || !authenticated}
          className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          {generateDesign.isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Figma className="w-5 h-5" />
              Generate Design
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">Job Status</h3>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Task ID: {result.taskId}</span>
            <span className={`px-2 py-1 rounded text-xs font-medium bg-green-500/20 text-green-400`}>
              Completed
            </span>
          </div>
          {result.result && (
            <p className="mt-2 text-sm text-gray-300">
              {result.result}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Executed {result.executedSteps} steps
          </p>
        </div>
      )}
    </div>
  );
};

export default DesignGeneratorDemo;