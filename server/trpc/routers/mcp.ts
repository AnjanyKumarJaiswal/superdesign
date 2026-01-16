import { router, protectedProcedure } from "@/trpc";
import { z } from "zod";
import { createWorkflow } from "@/ai_agent/orchestrator";
import { workflowEmitter } from "@/ai_agent/langgraph_nodes";

const LOG_PREFIX = "[DESIGN-GEN]";

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
            const taskId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            console.log(`${LOG_PREFIX} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`${LOG_PREFIX} 🚀 Task Started: ${taskId}`);
            console.log(`${LOG_PREFIX}    Provider: ${input.provider}`);
            console.log(`${LOG_PREFIX}    Action: ${input.action}`);

            try {
                console.log(`${LOG_PREFIX} 📋 Creating workflow...`);
                const workflow = createWorkflow();

                console.log(`${LOG_PREFIX} ▶️  Invoking workflow...`);
                const result = await workflow.invoke({
                    taskId,
                    prompt: `Execute action: ${input.action}`,
                    fileId: input.payload.fileId || "",
                    platform: input.provider,
                    accessToken: input.payload.accessToken || ctx.user.accessToken,
                    steps: [],
                    executedSteps: [],
                    currentStep: 0,
                    finalMessage: null,
                    messages: [],
                });

                console.log(`${LOG_PREFIX} ✅ Task Completed: ${taskId}`);
                console.log(`${LOG_PREFIX} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                return {
                    taskId,
                    status: "completed",
                    result: result.finalMessage
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`${LOG_PREFIX} ❌ Task Failed: ${taskId}`);
                console.error(`${LOG_PREFIX}    Error: ${errorMessage}`);
                console.log(`${LOG_PREFIX} ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                throw new Error(`MCP execution failed: ${errorMessage}`);
            }
        }),
});

export const mcpGenerateDesign = protectedProcedure
    .input(
        z.object({
            prompt: z.string(),
            fileId: z.string(),
            platform: z.enum(["figma", "framer", "canva"]).default("figma"),
        }),
    )
    .mutation(async ({ input, ctx }) => {
        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        console.log(`\n${LOG_PREFIX} ╔══════════════════════════════════════════════════════════╗`);
        console.log(`${LOG_PREFIX} ║  🎨 DESIGN GENERATION STARTED                            ║`);
        console.log(`${LOG_PREFIX} ╠══════════════════════════════════════════════════════════╣`);
        console.log(`${LOG_PREFIX} ║  Task ID:  ${taskId}`);
        console.log(`${LOG_PREFIX} ║  Platform: ${input.platform}`);
        console.log(`${LOG_PREFIX} ║  File ID:  ${input.fileId.substring(0, 30)}...`);
        console.log(`${LOG_PREFIX} ║  Prompt:   "${input.prompt.substring(0, 40)}..."`);
        console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════════╝\n`);

        const accessToken = ctx.user.accessToken;
        if (!accessToken) {
            console.error(`${LOG_PREFIX} ❌ No access token available`);
            throw new Error(`No access token available for ${input.platform}. Please re-authenticate.`);
        }
        console.log(`${LOG_PREFIX} ✓ Access token verified`);

        try {
            console.log(`${LOG_PREFIX} 📋 Step 1: Creating workflow...`);
            const workflow = createWorkflow();
            console.log(`${LOG_PREFIX} ✓ Workflow created`);

            console.log(`${LOG_PREFIX} ▶️  Step 2: Invoking workflow...`);
            const startTime = Date.now();

            const result = await workflow.invoke({
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

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            console.log(`\n${LOG_PREFIX} ╔══════════════════════════════════════════════════════════╗`);
            console.log(`${LOG_PREFIX} ║  ✅ DESIGN GENERATION COMPLETED                          ║`);
            console.log(`${LOG_PREFIX} ╠══════════════════════════════════════════════════════════╣`);
            console.log(`${LOG_PREFIX} ║  Task ID:        ${taskId}`);
            console.log(`${LOG_PREFIX} ║  Duration:       ${duration}s`);
            console.log(`${LOG_PREFIX} ║  Steps Executed: ${result.executedSteps?.length || 0}`);
            console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════════╝\n`);

            return {
                taskId,
                status: "completed",
                userId: ctx.user.userId,
                result: result.finalMessage,
                executedSteps: result.executedSteps?.length || 0
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            console.log(`\n${LOG_PREFIX} ╔══════════════════════════════════════════════════════════╗`);
            console.log(`${LOG_PREFIX} ║  ❌ DESIGN GENERATION FAILED                             ║`);
            console.log(`${LOG_PREFIX} ╠══════════════════════════════════════════════════════════╣`);
            console.log(`${LOG_PREFIX} ║  Task ID: ${taskId}`);
            console.log(`${LOG_PREFIX} ║  Error:   ${errorMessage.substring(0, 45)}...`);
            console.log(`${LOG_PREFIX} ╚══════════════════════════════════════════════════════════╝\n`);

            workflowEmitter.emit({
                type: "failed",
                taskId,
                message: "Workflow execution failed",
                error: errorMessage,
            });
            throw new Error(`Design generation failed: ${errorMessage}`);
        }
    });