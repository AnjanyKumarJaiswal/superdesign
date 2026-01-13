import { router, protectedProcedure } from "@/trpc";
import { mcp } from "@/mcp";
import { z } from "zod";
import { jobManager } from "@/jobs/jobManager";
import { createWorkflow } from "@/ai_agent/orchestrator";
import { workflowEmitter } from "@/ai_agent/langgraph_nodes";

export const mcpTasks = router({
    executeTasks: protectedProcedure
        .input(
            z.object({
                provider: z.enum(["figma", "framer", "canva"]),
                action: z.string(),
                payload: z.record(z.any()),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const provider = mcp.getProvider(input.provider);
            if (!provider) {
                throw new Error(`Provider ${input.provider} is not available. Please wait for initialization.`);
            }

            const taskId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            jobManager.create(taskId);
            jobManager.setStatus(taskId, "running", {
                result: { message: `Executing ${input.action} on ${input.provider}` },
            });

            try {
                const payload = {
                    ...input.payload,
                    accessToken: input.payload.accessToken || ctx.user.accessToken
                };

                const result = await mcp.execute({
                    id: taskId,
                    provider: input.provider,
                    action: input.action,
                    payload: payload,
                });

                jobManager.setStatus(taskId, "completed", { result: result.data });
                return { taskId, result };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`MCP task execution failed:`, error);
                jobManager.setStatus(taskId, "failed", {
                    error: errorMessage,
                });
                throw new Error(`MCP execution failed: ${errorMessage}`);
            }
        }),
})

export const mcpGenerateDesign = router({
    generateDesign: protectedProcedure
        .input(
            z.object({
                prompt: z.string(),
                fileId: z.string(),
                platform: z.enum(["figma", "framer", "canva"]).default("figma"),
            }),
        )
        .mutation(async ({ input, ctx }) => {
            const provider = mcp.getProvider(input.platform);
            if (!provider) {
                throw new Error(`Provider ${input.platform} is not available. Please wait for initialization or check server logs.`);
            }

            const accessToken = ctx.user.accessToken;
            if (!accessToken) {
                throw new Error(`No access token available for ${input.platform}. Please re-authenticate.`);
            }

            const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            jobManager.create(taskId);
            jobManager.setStatus(taskId, "running", {
                result: { message: "Planning design..." },
            });

            setImmediate(async () => {
                try {
                    const workflow = createWorkflow();
                    await workflow.invoke({
                        taskId,
                        prompt: input.prompt,
                        fileId: input.fileId,
                        platform: input.platform,
                        accessToken: accessToken,
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
                    jobManager.setStatus(taskId, "failed", {
                        error: (error as Error).message,
                    });
                }
            });

            return { taskId, status: "started", userId: ctx.user.userId };
        }),
})