import { useState } from "react";
import { trpc } from "../utils/trpc";
import { isAuthenticated, getCurrentUser } from "../utils/auth";
import { Loader2, AlertCircle, CheckCircle, Figma, Sparkles } from "lucide-react";
import LoginButton from "./LoginButton";

/**
 * Demo component showing authenticated design generation
 * Use this as a reference for integrating tRPC + OAuth in your app
 */
const DesignGeneratorDemo = () => {
  const authenticated = isAuthenticated();
  const user = getCurrentUser();
  const [prompt, setPrompt] = useState("");
  const [fileId, setFileId] = useState("");
  const [taskId, setTaskId] = useState(null);

  // tRPC mutation for authenticated design generation
  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("✅ Design generation started:", data);
      setTaskId(data.taskId);
      alert(`Design generation started! Task ID: ${data.taskId}`);
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

  // Poll job status
  const jobStatus = trpc.getJobStatus.useQuery(
    { jobId: taskId || "" },
    {
      enabled: !!taskId,
      refetchInterval: (data) => {
        // Stop polling when complete or failed
        if (data?.status === "completed" || data?.status === "failed") {
          return false;
        }
        return 2000; // Poll every 2 seconds
      },
    }
  );

  const handleGenerate = () => {
    if (!authenticated) {
      alert("Please log in with Figma first!");
      return;
    }