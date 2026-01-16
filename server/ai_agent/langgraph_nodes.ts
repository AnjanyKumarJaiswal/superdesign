import { WorkflowState } from "@/types";
import { WorkflowEventEmitter } from "@/ai_agent/event";
import { MCPClient } from "@/mcp/mcpClient";

export const workflowEmitter = new WorkflowEventEmitter();
const MCP_SERVER_URL = process.env.SUPERDESIGN_MCP_URL || "http://localhost:3846/sse";
const LOG = "[WORKFLOW]";

// Store client per taskId to avoid reuse issues
const activeClients: Map<string, MCPClient> = new Map();

function getOrCreateClient(taskId: string): MCPClient {
    if (!activeClients.has(taskId)) {
        console.log(`${LOG} Creating new MCP Client for task: ${taskId}`);
        console.log(`${LOG}    MCP Server URL: ${MCP_SERVER_URL}`);
        activeClients.set(taskId, new MCPClient(MCP_SERVER_URL));
    }
    return activeClients.get(taskId)!;
}

async function cleanupClient(taskId: string): Promise<void> {
    const client = activeClients.get(taskId);
    if (client) {
        try {
            console.log(`${LOG} Cleaning up MCP Client for task: ${taskId}`);
            await client.disconnect();
        } catch (e) {
            // Ignore disconnect errors
        }
        activeClients.delete(taskId);
    }
}

export async function plannerNode(
    state: WorkflowState
): Promise<Partial<WorkflowState>> {
    console.log(`\n${LOG} ┌─────────────────────────────────────────────────┐`);
    console.log(`${LOG} │  📝 PLANNER NODE                                │`);
    console.log(`${LOG} └─────────────────────────────────────────────────┘`);
    console.log(`${LOG} Task:     ${state.taskId}`);
    console.log(`${LOG} Platform: ${state.platform}`);
    console.log(`${LOG} Prompt:   "${state.prompt.substring(0, 50)}..."`);

    workflowEmitter.emit({
        type: "planning",
        taskId: state.taskId,
        message: "Connecting to MCP Server and generating plan...",
    });

    const mcpClient = getOrCreateClient(state.taskId);

    try {
        console.log(`${LOG} 1️⃣  Connecting to SuperDesign MCP Server...`);
        await mcpClient.connect();
        console.log(`${LOG}    ✓ Connected to MCP Server`);

        console.log(`${LOG} 2️⃣  Setting platform: ${state.platform}...`);
        await mcpClient.setPlatform(state.platform, state.accessToken);
        console.log(`${LOG}    ✓ Platform set, tools loaded`);

        workflowEmitter.emit({
            type: "planning",
            taskId: state.taskId,
            message: `Loaded tools from ${state.platform}. Generating plan with Gemini...`,
        });

        console.log(`${LOG} 3️⃣  Generating plan with Gemini AI...`);
        const steps = await mcpClient.generatePlan(state.prompt, state.fileId);

        console.log(`${LOG}    ✓ Plan generated with ${steps.length} steps:`);
        steps.forEach((step, i) => {
            console.log(`${LOG}       Step ${i + 1}: ${step.tool}`);
        });

        workflowEmitter.emit({
            type: "planning",
            taskId: state.taskId,
            message: `Generated ${steps.length} steps`,
            data: { steps },
        });

        console.log(`${LOG} ✅ Planner completed\n`);

        return {
            steps,
            currentStep: 0,
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`${LOG} ❌ PLANNER FAILED: ${errorMsg}`);

        workflowEmitter.emit({
            type: "failed",
            taskId: state.taskId,
            message: "Planning failed",
            error: errorMsg,
        });

        await cleanupClient(state.taskId);
        throw error;
    }
}

export async function executorNode(
    state: WorkflowState
): Promise<Partial<WorkflowState>> {
    const step = state.steps[state.currentStep];

    if (!step) {
        console.log(`${LOG} No more steps to execute`);
        return { finalMessage: "No more steps to execute" };
    }

    console.log(`\n${LOG} ┌─────────────────────────────────────────────────┐`);
    console.log(`${LOG} │  ⚡ EXECUTOR NODE - Step ${state.currentStep + 1}/${state.steps.length}                    │`);
    console.log(`${LOG} └─────────────────────────────────────────────────┘`);
    console.log(`${LOG} Tool:   ${step.tool}`);
    console.log(`${LOG} Params: ${JSON.stringify(step.params).substring(0, 60)}...`);

    const mcpClient = getOrCreateClient(state.taskId);

    workflowEmitter.emit({
        type: "executing",
        taskId: state.taskId,
        message: `Executing step ${state.currentStep + 1}/${state.steps.length}: ${step.tool}`,
    });

    try {
        console.log(`${LOG} 🔄 Executing step via MCP...`);
        const result = await mcpClient.executeStep(
            step.tool,
            { ...step.params, fileKey: state.fileId },
            state.accessToken
        );

        console.log(`${LOG} ✓ Step ${state.currentStep + 1} completed`);

        const executedStep = { ...step, result };
        const executedSteps = [...state.executedSteps, executedStep];

        workflowEmitter.emit({
            type: "executing",
            taskId: state.taskId,
            message: `Step ${state.currentStep + 1} completed successfully`,
            data: { result, stepIndex: state.currentStep },
        });

        return {
            executedSteps,
            currentStep: state.currentStep + 1,
        };

    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`${LOG} ❌ Step ${state.currentStep + 1} FAILED: ${errorMsg}`);

        workflowEmitter.emit({
            type: "failed",
            taskId: state.taskId,
            message: `Step ${state.currentStep + 1} failed`,
            error: errorMsg,
        });

        throw error;
    }
}

export async function finalizerNode(
    state: WorkflowState
): Promise<Partial<WorkflowState>> {
    console.log(`\n${LOG} ┌─────────────────────────────────────────────────┐`);
    console.log(`${LOG} │  🏁 FINALIZER NODE                              │`);
    console.log(`${LOG} └─────────────────────────────────────────────────┘`);

    const successfulSteps = state.executedSteps.filter(s => s.result);
    const finalMessage = `Design completed! Executed ${successfulSteps.length}/${state.steps.length} steps successfully.`;

    console.log(`${LOG} Total Steps:      ${state.steps.length}`);
    console.log(`${LOG} Successful Steps: ${successfulSteps.length}`);
    console.log(`${LOG} Final Message:    ${finalMessage}`);

    workflowEmitter.emit({
        type: "completed",
        taskId: state.taskId,
        message: finalMessage,
        data: {
            totalSteps: state.steps.length,
            executedSteps: state.executedSteps,
        },
    });

    // Cleanup client for this task
    await cleanupClient(state.taskId);
    console.log(`${LOG} ✅ Workflow completed and cleaned up\n`);

    return { finalMessage };
}