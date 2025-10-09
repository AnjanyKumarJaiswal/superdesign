import { EventEmitter } from "events";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPProvider, MCPResult, MCPTask } from "@/utils/types";

export class FigmaProvider extends EventEmitter implements MCPProvider {
  readonly providerName = "figma";
  private mcpClient: Client | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize MCP client connection to Figma MCP server
   */
  private async initializeMCPClient(): Promise<void> {
    if (this.isConnected && this.mcpClient) {
      return;
    }

    // If already connecting, wait for that connection
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = (async () => {
      try {
        console.log("[FigmaProvider] Initializing MCP client...");

        // Create MCP client
        this.mcpClient = new Client(
          {
            name: "figma-provider-client",
            version: "1.0.0",
          },
          {
            capabilities: {
              tools: {},
            },
          },
        );

        // Create stdio transport to connect to Figma MCP server
        // This assumes there's a Figma MCP server running as a subprocess
        const transport = new StdioClientTransport({
          command: "npx",
          args: ["-y", "@modelcontextprotocol/server-figma"],
          env: {
            ...process.env,
            FIGMA_ACCESS_TOKEN: process.env.FIGMA_ACCESS_TOKEN || "",
          },
        });

        // Connect to the MCP server
        await this.mcpClient.connect(transport);

        this.isConnected = true;
        console.log("[FigmaProvider] MCP client connected successfully");
      } catch (error) {
        console.error(
          "[FigmaProvider] Failed to initialize MCP client:",
          error,
        );
        this.isConnected = false;
        this.mcpClient = null;
        throw error;
      } finally {
        this.connectionPromise = null;
      }
    })();

    return this.connectionPromise;
  }

  /**
   * Get available tools from Figma MCP server
   */
  async getAvailableTools(): Promise<any[]> {
    await this.initializeMCPClient();

    if (!this.mcpClient) {
      throw new Error("MCP client not initialized");
    }

    try {
      const response = await this.mcpClient.listTools();
      return response.tools || [];
    } catch (error) {
      console.error("[FigmaProvider] Failed to list tools:", error);
      return [];
    }
  }

  /**
   * Execute a tool call on Figma MCP server
   */
  private async executeToolCall(
    toolName: string,
    args: Record<string, any>,
  ): Promise<any> {
    await this.initializeMCPClient();

    if (!this.mcpClient) {
      throw new Error("MCP client not initialized");
    }

    try {
      const response = await this.mcpClient.callTool({
        name: toolName,
        arguments: args,
      });

      return response;
    } catch (error) {
      console.error(`[FigmaProvider] Tool call failed for ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Map task action to MCP tool name
   */
  private mapActionToTool(action: string): string {
    const actionMap: Record<string, string> = {
      createElement: "figma_create_node",
      createRectangle: "figma_create_rectangle",
      createText: "figma_create_text",
      createFrame: "figma_create_frame",
      modifyElement: "figma_update_node",
      deleteElement: "figma_delete_node",
      getFileInfo: "figma_get_file",
      listElements: "figma_list_nodes",
      exportElement: "figma_export_image",
      groupElements: "figma_group_nodes",
    };

    return actionMap[action] || action;
  }

  /**
   * Run a task using MCP client
   */
  async runTask(task: MCPTask): Promise<MCPResult> {
    this.emit("taskStart", task);

    try {
      // Emit progress
      this.emit("taskProgress", {
        task,
        progress: "Connecting to Figma MCP server...",
        data: { action: task.action },
      });

      // Initialize MCP client if needed
      await this.initializeMCPClient();

      // Map action to MCP tool name
      const toolName = this.mapActionToTool(task.action);

      this.emit("taskProgress", {
        task,
        progress: `Executing ${task.action} via MCP...`,
        data: { toolName, payload: task.payload },
      });

      // Extract file_key and access_token from payload or environment
      const fileKey = task.payload.fileId || task.payload.file_key;
      const accessToken =
        task.payload.accessToken || process.env.FIGMA_ACCESS_TOKEN;

      if (!fileKey) {
        throw new Error("Missing file_key in task payload");
      }

      if (!accessToken) {
        throw new Error(
          "Missing access_token - please authenticate with Figma first",
        );
      }

      // Prepare arguments for MCP tool call
      const toolArgs: Record<string, any> = {
        file_key: fileKey,
        access_token: accessToken,
        ...task.payload,
      };

      // Remove accessToken from payload to avoid duplication
      delete toolArgs.accessToken;
      delete toolArgs.fileId;

      // Execute tool via MCP
      console.log(`[FigmaProvider] Calling MCP tool: ${toolName}`);
      const mcpResponse = await this.executeToolCall(toolName, toolArgs);

      // Parse MCP response
      const result: MCPResult = {
        taskId: task.id,
        status: "completed",
        data: {
          message: `Figma ${task.action} executed successfully`,
          action: task.action,
          toolName,
          mcpResponse,
          payload: task.payload,
        },
      };

      this.emit("taskComplete", { task, result });
      return result;
    } catch (error) {
      console.error(`[FigmaProvider] Task failed:`, error);

      const result: MCPResult = {
        taskId: task.id,
        status: "failed",
        error: (error as Error).message,
      };

      this.emit("taskError", { task, error: result.error! });
      return result;
    }
  }

  /**
   * Fallback method: Run task without MCP (simulation mode)
   */
  async runTaskSimulated(task: MCPTask): Promise<MCPResult> {
    this.emit("taskStart", task);

    try {
      // Simulate API call with progress updates
      this.emit("taskProgress", {
        task,
        progress: "Connecting to Figma API...",
        data: { action: task.action },
      });

      await new Promise((resolve) => setTimeout(resolve, 500));

      this.emit("taskProgress", {
        task,
        progress: `Executing ${task.action}...`,
        data: { payload: task.payload },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const result: MCPResult = {
        taskId: task.id,
        status: "completed",
        data: {
          message: `Figma ${task.action} executed successfully (simulated)`,
          action: task.action,
          elementId: `${task.action}-${Date.now()}`,
          payload: task.payload,
          mode: "simulated",
        },
      };

      this.emit("taskComplete", { task, result });
      return result;
    } catch (error) {
      const result: MCPResult = {
        taskId: task.id,
        status: "failed",
        error: (error as Error).message,
      };

      this.emit("taskError", { task, error: result.error! });
      return result;
    }
  }

  /**
   * Cleanup and disconnect MCP client
   */
  async shutdown(): Promise<void> {
    if (this.mcpClient && this.isConnected) {
      try {
        console.log("[FigmaProvider] Shutting down MCP client...");
        await this.mcpClient.close();
        this.mcpClient = null;
        this.isConnected = false;
        console.log("[FigmaProvider] MCP client disconnected");
      } catch (error) {
        console.error("[FigmaProvider] Error during shutdown:", error);
      }
    }
  }

  /**
   * Check if MCP client is connected
   */
  isReady(): boolean {
    return this.isConnected && this.mcpClient !== null;
  }

  /**
   * Get connection status
   */
  getStatus(): {
    connected: boolean;
    hasClient: boolean;
    providerName: string;
  } {
    return {
      connected: this.isConnected,
      hasClient: this.mcpClient !== null,
      providerName: this.providerName,
    };
  }
}
