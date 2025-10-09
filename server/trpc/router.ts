import { initTRPC } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import type { TRPCContext } from "./context";
import { taskRouter } from "./procedures";
import { createWorkflow, workflowEmitter, type WorkflowEvent } from "@/orchestrator/orchestrator";
import { mcp } from "@/mcp";
import { z } from "zod";

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true, timestamp: new Date().toISOString() })),
  task: taskRouter,

  // Generate design with LangGraph workflow
  generateDesign: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        fileId: z.string(),
        platform: z.enum(["figma", "framer", "canva"]).default("figma"),
        accessToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Start workflow in background
      setImmediate(async () => {
        try {
          const workflow = createWorkflow();
          await workflow.invoke({
            taskId,
            prompt: input.prompt,
            fileId: input.fileId,
            platform: input.platform,
            accessToken: input.accessToken,
            steps: [],
            executedSteps: [],
            currentStep: 0,
            finalMessage: null,
            messages: [],
          });
        } catch (error) {
          workflowEmitter.emit({
            type: "failed",
            taskId,
            message: "Workflow execution failed",
            error: (error as Error).message,
          });
        }
      });

      return { taskId, status: "started" };
    }),

  // Real-time subscription for workflow events
  onWorkflowEvent: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .subscription(({ input }) => {
      return observable<WorkflowEvent>((emit) => {
        const unsubscribe = workflowEmitter.on(input.taskId, (event) => {
          emit.next(event);
        });

        return () => {
          unsubscribe();
        };
      });
    }),

  // Real-time subscription for MCP events
  onMCPEvent: publicProcedure
    .input(z.object({ taskId: z.string().optional() }))
    .subscription(({ input }) => {
      return observable((emit) => {
        const handlers = {
          taskStart: (data: any) => emit.next({ type: "taskStart", ...data }),
          taskProgress: (data: any) => emit.next({ type: "taskProgress", ...data }),
          taskComplete: (data: any) => emit.next({ type: "taskComplete", ...data }),
          taskError: (data: any) => emit.next({ type: "taskError", ...data }),
        };

        // Listen to MCP events
        mcp.on("taskStart", handlers.taskStart);
        mcp.on("taskProgress", handlers.taskProgress);
        mcp.on("taskComplete", handlers.taskComplete);
        mcp.on("taskError", handlers.taskError);

        return () => {
          mcp.off("taskStart", handlers.taskStart);
          mcp.off("taskProgress", handlers.taskProgress);
          mcp.off("taskComplete", handlers.taskComplete);
          mcp.off("taskError", handlers.taskError);
        };
      });
    }),

  // Get available providers
  getProviders: publicProcedure.query(() => {
    return { providers: mcp.getProviders() };
  }),

  // Direct MCP execution for testing
  executeMCPTask: publicProcedure
    .input(
      z.object({
        provider: z.enum(["figma", "framer", "canva"]),
        action: z.string(),
        payload: z.record(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      const taskId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const result = await mcp.execute({
        id: taskId,
        provider: input.provider,
        action: input.action,
        payload: input.payload,
      });

      return { taskId, result };
    }),
});

export type AppRouter = typeof appRouter;


