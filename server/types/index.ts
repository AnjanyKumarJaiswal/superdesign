import { EventEmitter } from "events";
import { Request } from "express";
export type ProviderName = "figma" | "framer" | "canva";


// MCP
export interface MCPTask {
    id: string;
    provider: ProviderName | "unknown";
    action: string;
    payload: Record<string, unknown>;
    metadata?: {
        createdAt: number;
        priority?: number;
    };
    parameters?: Record<string, unknown>;
    timestamp?: number;
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

// Server Event
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


// Authentication
export interface UserPayload {
    userId: string;
    platform: "figma" | "framer";
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: number;
}

export interface JWTPayload extends UserPayload {
    iat: number;
    exp: number;
}

export interface AuthRequest extends Request {
    user?: {
        userId: string;
        platform: "figma" | "framer";
        accessToken: string;
        refreshToken?: string;
        tokenExpiry?: number;
    };
}

export interface AuthenticatedUser {
    userId: string;
    platform: "figma" | "framer";
    accessToken: string;
    refreshToken?: string;
}

export interface OAuthTokenResponse {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    tokenType: string;
    scope?: string;
    providerUserId?: string;
}

// Job Status
export type JobStatus = "queued" | "running" | "completed" | "failed";

export type JobRecord = {
    id: string;
    status: JobStatus;
    result?: unknown;
    error?: string;
};

// Workflow / Orchestrator
import { BaseMessage } from "@langchain/core/messages";

export interface WorkflowState {
    taskId: string;
    prompt: string;
    fileId: string;
    platform: "figma" | "framer" | "canva";
    accessToken?: string;
    steps: Array<{ tool: string; params: Record<string, unknown> }>;
    executedSteps: Array<{
        tool: string;
        params: Record<string, unknown>;
        result?: unknown;
    }>;
    currentStep: number;
    finalMessage: string | null;
    messages: BaseMessage[];
}

export interface WorkflowEvent {
    type: "planning" | "executing" | "completed" | "failed";
    taskId: string;
    message: string;
    data?: unknown;
    error?: string;
}

export const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
};