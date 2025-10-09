import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { mcp } from "@/mcp";

// LangGraph State
export interface WorkflowState {
  taskId: string;
  prompt: string;
  fileId: string;
  platform: "figma" | "framer" | "canva";
  accessToken?: string;
  steps: Array<{ tool: string; params: Record<string, unknown> }>;
  executedSteps: Array<{
    tool: string;
    params: Record<string, unknown>;
    result?: unknown;
  }>;
  currentStep: number;
  finalMessage: string | null;
  messages: BaseMessage[];
}

// Event emitter for real-time updates
export interface WorkflowEvent {
  type: "planning" | "executing" | "completed" | "failed";
  taskId: string;
  message: string;
  data?: unknown;
  error?: string;
}

export class WorkflowEventEmitter {
  private listeners = new Map<string, Set<(event: WorkflowEvent) => void>>();

  emit(event: WorkflowEvent) {
    const listeners = this.listeners.get(event.taskId);
    if (listeners) {
      listeners.forEach((listener) => listener(event));
    }
  }

  on(taskId: string, listener: (event: WorkflowEvent) => void) {
    if (!this.listeners.has(taskId)) {
      this.listeners.set(taskId, new Set());
    }
    this.listeners.get(taskId)!.add(listener);

    return () => {
      this.listeners.get(taskId)?.delete(listener);
    };
  }
}

export const workflowEmitter = new WorkflowEventEmitter();

// Planner Node
async function plannerNode(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  workflowEmitter.emit({
    type: "planning",
    taskId: state.taskId,
    message: "Analyzing prompt and creating execution plan...",
  });

  // Mock LLM planning - replace with actual LLM call
  const steps = [
    { tool: "createRectangle", params: { width: 200, height: 50, color: "#3B82F6" } },
    { tool: "createText", params: { content: "Sign Up", fontSize: 18 } },
    { tool: "groupElements", params: { elementIds: ["rect-id", "text-id"] } },
  ];

  workflowEmitter.emit({
    type: "planning",
    taskId: state.taskId,
    message: `Plan created with ${steps.length} steps`,
    data: { steps },
  });

  return {
    steps,
    currentStep: 0,
  };
}

// Executor Node
async function executorNode(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  const step = state.steps[state.currentStep];
  if (!step) {
    return { finalMessage: "No more steps to execute" };
  }

  workflowEmitter.emit({
    type: "executing",
    taskId: state.taskId,
    message: `Executing step ${state.currentStep + 1}/${state.steps.length}: ${step.tool}`,
  });

  try {
    const res = await mcp.execute({
      id: `${state.taskId}:${state.currentStep}`,
      provider: state.platform,
      action: step.tool,
      payload: { fileId: state.fileId, ...step.params },
    });

    if (res.status !== "completed") {
      throw new Error(res.error || "Step failed");
    }

    const executedStep = { ...step, result: res.data };
    const executedSteps = [...state.executedSteps, executedStep];

    workflowEmitter.emit({
      type: "executing",
      taskId: state.taskId,
      message: `Step ${state.currentStep + 1} completed successfully`,
      data: { result: res.data, stepIndex: state.currentStep },
    });

    return {
      executedSteps,
      currentStep: state.currentStep + 1,
    };
  } catch (error) {
    workflowEmitter.emit({
      type: "failed",
      taskId: state.taskId,
      message: `Step ${state.currentStep + 1} failed`,
      error: (error as Error).message,
    });
    throw error;
  }
}

// Finalizer Node
async function finalizerNode(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  const finalMessage = `Design completed successfully! Created ${state.executedSteps.length} elements.`;

  workflowEmitter.emit({
    type: "completed",
    taskId: state.taskId,
    message: finalMessage,
    data: {
      totalSteps: state.steps.length,
      executedSteps: state.executedSteps,
    },
  });

  return { finalMessage };
}

// Conditional edges
function shouldContinue(state: WorkflowState): string {
  return state.currentStep < state.steps.length ? "execute" : "finalize";
}

// Create the workflow graph
export function createWorkflow() {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      taskId: { value: (x: string) => x },
      prompt: { value: (x: string) => x },
      fileId: { value: (x: string) => x },
      platform: { value: (x: "figma" | "framer" | "canva") => x },
      accessToken: { value: (x: string | undefined) => x },
      steps: {
        value: (x: Array<{ tool: string; params: Record<string, unknown> }>) =>
          x,
      },
      executedSteps: {
        value: (
          x: Array<{
            tool: string;
            params: Record<string, unknown>;
            result?: unknown;
          }>,
        ) => x,
      },
      currentStep: { value: (x: number) => x },
      finalMessage: { value: (x: string | null) => x },
      messages: { value: (x: BaseMessage[]) => x },
    },
  });

  // Add nodes
  workflow.addNode("planner", plannerNode);
  workflow.addNode("executor", executorNode);
  workflow.addNode("finalizer", finalizerNode);

  // Add edges
  workflow.addEdge(START, "planner");
  workflow.addConditionalEdges("planner", shouldContinue, {
    execute: "executor",
    finalize: "finalizer",
  });
  workflow.addConditionalEdges("executor", shouldContinue, {
    execute: "executor",
    finalize: "finalizer",
  });
  workflow.addEdge("finalizer", END);

  return workflow.compile();
}

// Legacy function for backward compatibility
export async function runOrchestration(opts: {
  taskId: string;
  prompt: string;
  fileId: string;
  platform: "figma" | "framer" | "canva";
  accessToken?: string;
}) {
  const workflow = createWorkflow();
  await workflow.invoke({
    taskId: opts.taskId,
    prompt: opts.prompt,
    fileId: opts.fileId,
    platform: opts.platform,
    accessToken: opts.accessToken,
    steps: [],
    executedSteps: [],
    currentStep: 0,
    finalMessage: null,
    messages: [],
  });
}
