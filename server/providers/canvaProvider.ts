import type { MCPProvider, MCPResult, MCPTask } from "@/server/mcp/mcp";

export class CanvaProvider implements MCPProvider {
  async runTask(task: MCPTask): Promise<MCPResult> {
    return {
      taskId: task.id,
      status: "completed",
      data: { message: "Canva task stub executed", action: task.action },
    };
  }
}


