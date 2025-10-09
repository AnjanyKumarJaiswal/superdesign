
import { EventEmitter } from "events";
export type ProviderName = "figma" | "framer" | "canva";

export interface MCPTask {
  id: string;
  provider: ProviderName | "unknown";
  action: string;
  payload: Record<string, unknown>;
  metadata?: {
    createdAt: number;
    priority?: number;
  };
}

export interface MCPResult {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed";
  data?: unknown;
  error?: string;
  completedAt?: number;
}

export interface MCPProvider extends EventEmitter {
  runTask(task: MCPTask): Promise<MCPResult>;
  readonly providerName: string;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

export interface ServerEvents {
  taskStart: { provider: string; task: MCPTask };
  taskProgress: { provider: string; task: MCPTask; progress: string; data?: unknown };
  taskComplete: { provider: string; task: MCPTask; result: MCPResult };
  taskError: { provider: string; task: MCPTask; error: string };
  taskCancelled: { task: MCPTask };
  initialized: void;
  shutdown: void;
  error: unknown;
}
export interface MCPMessage {
  id: string;
  method?: string;
  command?: string;
  params?: Record<string, unknown>;
}

export interface MCPResponseMessage {
  id: string;
  result: unknown;
}

export interface MCPErrorMessage {
  id: string;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}