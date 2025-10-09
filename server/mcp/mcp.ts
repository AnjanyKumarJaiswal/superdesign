export type MCPTask = {
  id: string;
  provider: "figma" | "framer" | "canva" | "unknown";
  action: string;
  payload: Record<string, unknown>;
};

export type MCPResult = {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed";
  data?: unknown;
  error?: string;
};

export interface MCPProvider {
  runTask(task: MCPTask): Promise<MCPResult>;
}

export class UnifiedMCPServer {
  private providers: Record<string, MCPProvider> = {};

  registerProvider(name: string, provider: MCPProvider) {
    this.providers[name] = provider;
  }

  async execute(task: MCPTask): Promise<MCPResult> {
    const provider = this.providers[task.provider];
    if (!provider) {
      return {
        taskId: task.id,
        status: "failed",
        error: `No provider registered for ${task.provider}`,
      };
    }
    return provider.runTask(task);
  }
}


