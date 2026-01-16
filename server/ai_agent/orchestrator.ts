import { StateGraph, END, START } from "@langchain/langgraph";
import { BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { WorkflowState } from "@/types";
import { plannerNode, executorNode, finalizerNode } from "./langgraph_nodes";


function shouldContinue(state: WorkflowState): string {
  return state.currentStep < state.steps.length ? "execute" : "finalize";
}

//langGraph workflow 
export function createWorkflow() {
  const workflow = new StateGraph<WorkflowState>({
    channels: {
      taskId: { value: (x: string, y?: string) => y ?? x },
      prompt: { value: (x: string, y?: string) => y ?? x },
      fileId: { value: (x: string, y?: string) => y ?? x },
      platform: {
        value: (
          x: "figma" | "framer" | "canva",
          y?: "figma" | "framer" | "canva",
        ) => y ?? x,
      },
      accessToken: { value: (x: string | undefined, y?: string) => y ?? x },
      steps: {
        value: (
          x: Array<{ tool: string; params: Record<string, unknown> }>,
          y?: Array<{ tool: string; params: Record<string, unknown> }>,
        ) => y ?? x,
      },
      executedSteps: {
        value: (
          x: Array<{
            tool: string;
            params: Record<string, unknown>;
            result?: unknown;
          }>,
          y?: Array<{
            tool: string;
            params: Record<string, unknown>;
            result?: unknown;
          }>,
        ) => y ?? x,
      },
      currentStep: { value: (x: number, y?: number) => y ?? x },
      finalMessage: { value: (x: string | null, y?: string | null) => y ?? x },
      messages: { value: (x: BaseMessage[], y?: BaseMessage[]) => y ?? x },
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
