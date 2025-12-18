import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { mcp } from "@/mcp";
import { HfInference } from "@huggingface/inference";
import { ChatHuggingFace } from "@langchain/huggingface";

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

async function plannerNode(
  state: WorkflowState,
): Promise<Partial<WorkflowState>> {
  workflowEmitter.emit({
    type: "planning",
    taskId: state.taskId,
    message: "Analyzing prompt and creating execution plan with Gemma...",
  });

  try {
    const hf = new HfInference(process.env.HUGGINGFACEHUB_API_TOKEN);
    const model = new ChatHuggingFace({
      llm: hf,
      model: "google/gemma-1.1-7b-it",
    });

    const systemPrompt = `You are an expert design automation agent. Your goal is to convert a user's natural language request into a sequence of specific tool calls.

Available Tools:
- createRectangle(width: number, height: number, color: string, x?: number, y?: number)
- createText(content: string, fontSize: number, x?: number, y?: number)
- groupElements(elementIds: string[])

Rules:
1. You must output ONLY a valid JSON array of steps.
2. No markdown formatting, no explanations.
3. Each step must have 'tool' and 'params'.
4. For colors, use hex codes.

Example Output:
[
  { "tool": "createRectangle", "params": { "width": 100, "height": 100, "color": "#FF0000" } },
  { "tool": "createText", "params": { "content": "Hello", "fontSize": 16 } }
]`;

    const response = await model.invoke([
      new SystemMessage(systemPrompt),
      new HumanMessage(state.prompt),
    ]);

    let content = response.content as string;
    content = content.replace(/```json/g, "").replace(/```/g, "").trim();

    const steps = JSON.parse(content);

    workflowEmitter.emit({
      type: "planning",
      taskId: state.taskId,
      message: `Gemma created a plan with ${steps.length} steps`,
      data: { steps },
    });

    return {
      steps,
      currentStep: 0,
    };
  } catch (error) {
    console.error("Planning failed:", error);

    workflowEmitter.emit({
      type: "planning",
      taskId: state.taskId,
      message: "AI planning failed, falling back to default plan",
      error: (error as Error).message
    });

    const fallbackSteps = [
      { tool: "createRectangle", params: { width: 200, height: 50, color: "#3B82F6" } },
      { tool: "createText", params: { content: "Error: AI Failed", fontSize: 18 } },
    ];

    return {
      steps: fallbackSteps,
      currentStep: 0,
    };
  }
}

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

function shouldContinue(state: WorkflowState): string {
  return state.currentStep < state.steps.length ? "execute" : "finalize";
}

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

  workflow.addNode("planner", plannerNode);
  workflow.addNode("executor", executorNode);
  workflow.addNode("finalizer", finalizerNode);

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
