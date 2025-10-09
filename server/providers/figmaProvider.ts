import type { MCPProvider, MCPResult, MCPTask } from "@/server/mcp/mcp";

export class FigmaProvider implements MCPProvider {
  async runTask(task: MCPTask): Promise<MCPResult> {
    // Placeholder: integrate Figma REST API here using user's OAuth token
    return {
      taskId: task.id,
      status: "completed",
      data: { message: "Figma task stub executed", action: task.action },
    };
  }
}


