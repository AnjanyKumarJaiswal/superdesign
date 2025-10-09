import type { MCPProvider, MCPResult, MCPTask } from "@/server/mcp/mcp";

export class FramerProvider implements MCPProvider {
  async runTask(task: MCPTask): Promise<MCPResult> {
    return {
      taskId: task.id,
      status: "completed",
      data: { message: "Framer task stub executed", action: task.action },
    };
  }
}


