import { EventEmitter } from "events";

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

export interface MCPProvider extends EventEmitter {
  runTask(task: MCPTask): Promise<MCPResult>;
  readonly providerName: string;
}

export class UnifiedMCPServer extends EventEmitter {
  private providers: Record<string, MCPProvider> = {};

  registerProvider(name: string, provider: MCPProvider) {
    this.providers[name] = provider;
    
    // Forward provider events
    provider.on("taskStart", (task: MCPTask) => {
      this.emit("taskStart", { provider: name, task });
    });
    
    provider.on("taskProgress", (data: { task: MCPTask; progress: string; data?: unknown }) => {
      this.emit("taskProgress", { provider: name, ...data });
    });
    
    provider.on("taskComplete", (data: { task: MCPTask; result: MCPResult }) => {
      this.emit("taskComplete", { provider: name, ...data });
    });
    
    provider.on("taskError", (data: { task: MCPTask; error: string }) => {
      this.emit("taskError", { provider: name, ...data });
    });
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
    
    this.emit("taskStart", { provider: task.provider, task });
    return provider.runTask(task);
  }

  getProviders(): string[] {
    return Object.keys(this.providers);
  }
}


