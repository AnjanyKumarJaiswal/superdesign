// utils/types.ts
import { EventEmitter } from "events";

// Define supported design platforms
export type ProviderName = "figma" | "framer" | "canva";

// Task representation for our internal use
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

// Result representation for our internal use
export interface MCPResult {
  taskId: string;
  status: "queued" | "running" | "completed" | "failed";
  data?: unknown;
  error?: string;
  completedAt?: number;
}

// Provider interface for platform-specific implementations
export interface MCPProvider extends EventEmitter {
  runTask(task: MCPTask): Promise<MCPResult>;
  readonly providerName: string;
  initialize?(): Promise<void>;
  shutdown?(): Promise<void>;
}

// Server events
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