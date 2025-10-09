import { jobManager } from "@/server/jobs/jobManager";
import { mcp } from "@/server/mcp";

export type OrchestratorState = {
  taskId: string;
  prompt: string;
  steps: Array<{ tool: string; params: Record<string, unknown> }>;
  executedSteps: Array<{ tool: string; params: Record<string, unknown>; result?: unknown }>;
  finalMessage: string | null;
};

function planStepsFromPrompt(prompt: string) {
  // Placeholder planner: map a generic button prompt to 3 steps
  // In production, replace with an LLM planning call
  return [
    { tool: "figma.createRectangle", params: { width: 200, height: 50, color: "#3B82F6" } },
    { tool: "figma.createText", params: { content: "Sign Up", fontSize: 18 } },
    { tool: "figma.groupElements", params: { elementIds: ["rect-id", "text-id"] } },
  ];
}

export async function runOrchestration(opts: { taskId: string; prompt: string; fileId: string; platform: "figma" | "framer" | "canva"; accessToken?: string }) {
  const { taskId, prompt, fileId, platform } = opts;
  const state: OrchestratorState = {
    taskId,
    prompt,
    steps: [],
    executedSteps: [],
    finalMessage: null,
  };

  // Node 1: Planner
  state.steps = planStepsFromPrompt(prompt);
  jobManager.setStatus(taskId, "running", { result: { message: "Plan created. Starting execution." } });

  // Node 2: Tool Executor Loop
  for (let i = 0; i < state.steps.length; i++) {
    const step = state.steps[i];
    try {
      const action = step.tool.replace(/^.*?\./, "");
      const res = await mcp.execute({
        id: `${taskId}:${i}`,
        provider: platform,
        action,
        payload: { fileId, ...step.params },
      });
      if (res.status !== "completed") throw new Error(res.error || "Step failed");
      state.executedSteps.push({ ...step, result: res.data });
      jobManager.setStatus(taskId, "running", { result: { message: `Step ${i + 1}/${state.steps.length} completed: ${step.tool}` } });
    } catch (err) {
      jobManager.setStatus(taskId, "failed", { error: (err as Error).message });
      return;
    }
  }

  // Node 3: Finalizer
  state.finalMessage = "All done! Your design is ready.";
  jobManager.setStatus(taskId, "completed", { result: { message: state.finalMessage } });
}


