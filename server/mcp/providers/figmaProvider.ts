import { EventEmitter } from "events";
import type { MCPProvider, MCPResult, MCPTask } from "@/types";
import { FigmaMCPClient } from "@/mcp/client/figmaMCPClient";

const ACTION_TO_TOOL_MAP: Record<string, string> = {
  'createElement': 'figma_create_shape',
  'createRectangle': 'figma_create_shape',
  'createText': 'figma_create_text',
  'modifyElement': 'figma_modify_node',
  'deleteElement': 'figma_delete_node',
  'groupElements': 'figma_group_nodes',
  'exportDesign': 'figma_export',
  'getFileInfo': 'figma_get_file',
  'listElements': 'figma_list_nodes',
  'processPrompt': 'figma_modify',
  'analyzePrompt': 'figma_analyze_prompt',
};

export class FigmaProvider extends EventEmitter implements MCPProvider {

  providerName: string = "Figma";
  private mcpClient: FigmaMCPClient;
  private isConnected = false;
  private fileKey?: string;
  private hostUrl: string = 'http://localhost:5173';

  constructor(config?: {
    mcpServerUrl?: string;
    defaultFileKey?: string;
    hostUrl?: string;
    accessToken?: string;
  }) {
    super();

    const mcpUrl = 'http://127.0.0.1:3845/sse';

    this.mcpClient = new FigmaMCPClient(
      mcpUrl,
      config?.accessToken || process.env.FIGMA_ACCESS_TOKEN
    );

    this.fileKey = config?.defaultFileKey || process.env.FIGMA_DEFAULT_FILE_KEY;
    this.hostUrl = config?.hostUrl || process.env.CLIENT_URL || 'http://localhost:5173';

    console.log(`FigmaProvider initialized with MCP URL: ${mcpUrl}, Host URL: ${this.hostUrl}`);
  }

  async initialize(): Promise<void> {
    try {
      console.log("Initializing Figma provider...");
      this.emit("info", "Connecting to Figma MCP Server...");

      let isAlive = false;
      try {
        isAlive = await this.mcpClient.ping();
        console.log(`Ping result: ${isAlive ? 'Success' : 'Failed'}`);
      } catch (pingError) {
        console.warn("Failed to ping Figma MCP Server:", pingError);
        console.warn("Continuing in embed-only mode");
      }

      if (!isAlive) {
        console.warn("Figma MCP Server is not responding, initializing in embed-only mode");
        this.isConnected = false;
        this.emit("info", "Figma provider initialized in embed-only mode");
        return;
      }

      try {
        const tools = await this.mcpClient.listTools();
        this.isConnected = true;

        if (Array.isArray(tools) && tools.length > 0) {
          console.log(`Successfully connected to Figma MCP server. Found ${tools.length} tools.`);
          this.emit("info", `Connected to Figma MCP Server. Available tools: ${tools.length}`);
        } else {
          console.warn("Connected to Figma MCP server but no tools were returned");
          this.emit("info", "Connected to Figma MCP Server but no tools available");
        }
      } catch (toolsError) {
        console.warn("Failed to list Figma MCP tools:", toolsError);
        this.isConnected = false;
      }

      if (this.isConnected) {
        console.log("✅ Figma provider initialized successfully");
      } else {
        console.warn("⚠️ Figma provider initialized in embed-only mode");
      }
    } catch (error) {
      this.isConnected = false;
      const message = error instanceof Error ? error.message : "Unknown error";
      console.warn(`Figma provider initialized in embed-only mode: ${message}`);
      this.emit("info", `Figma provider initialized in embed-only mode: ${message}`);
    }
  }

  async getEmbedUrl(fileId: string, accessToken?: string): Promise<string> {
    try {
      if (!fileId) {
        throw new Error("File ID is required to generate embed URL");
      }

      const fileKey = this.extractFileKey(fileId);
      if (!fileKey) {
        throw new Error(`Could not extract a valid file key from: ${fileId}`);
      }

      const embedUrl = this.generateEmbedUrl(fileId, accessToken, undefined);

      console.log(`Embed URL generated: ${embedUrl}`);

      return embedUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.emit("error", `Failed to generate Figma embed URL: ${message}`);
      throw error;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async runTask(task: MCPTask): Promise<MCPResult> {
    if (!this.isConnected && task.action !== 'generateEmbedUrl') {
      return {
        taskId: task.id,
        status: "failed",
        error: "Figma provider not connected. Call initialize() first.",
        completedAt: Date.now(),
      };
    }

    this.emit("taskStart", task);

    try {
      if (task.action === 'processPrompt') {
        return this.handlePromptTask(task);
      }

      if (task.action === 'generateEmbedUrl') {
        return this.handleEmbedUrlTask(task);
      }

      const toolName = this.mapActionToTool(task.action);

      this.emit("taskProgress", {
        task,
        progress: `Calling Figma MCP tool: ${toolName}`,
        data: { tool: toolName, action: task.action }
      });

      const toolArgs = this.prepareToolArguments(task);
      const mcpResult = await this.mcpClient.callTools(toolName, toolArgs);

      this.emit("taskProgress", {
        task,
        progress: "Processing Figma response...",
        data: { result: mcpResult }
      });

      const result: MCPResult = {
        taskId: task.id,
        status: "completed",
        data: mcpResult,
        completedAt: Date.now(),
      };

      this.emit("taskComplete", { task, result });
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      const result: MCPResult = {
        taskId: task.id,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      };

      this.emit("taskError", { task, error: errorMessage });
      return result;
    }
  }

  private async handlePromptTask(task: MCPTask): Promise<MCPResult> {
    try {
      const { fileId, prompt, accessToken } = task.payload as {
        fileId: string;
        prompt: string;
        accessToken: string;
      };

      if (!fileId || !prompt) {
        throw new Error("Missing required parameters: fileId and prompt");
      }

      this.emit("taskProgress", {
        task,
        progress: `Processing prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`,
      });

      const fileKey = this.extractFileKey(fileId);
      const result = await this.mcpClient.processPrompt(fileKey, prompt);

      return {
        taskId: task.id,
        status: "completed",
        data: result,
        completedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        taskId: task.id,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      };
    }
  }

  private async handleEmbedUrlTask(task: MCPTask): Promise<MCPResult> {
    try {
      const { fileId, nodeId, accessToken } = task.payload as {
        fileId: string;
        nodeId?: string;
        accessToken?: string;
      };

      if (!fileId) {
        throw new Error("Missing required parameter: fileId");
      }

      this.emit("taskProgress", {
        task,
        progress: `Generating embed URL for file: ${fileId}`,
      });

      const embedUrl = this.generateEmbedUrl(fileId, accessToken, nodeId);

      return {
        taskId: task.id,
        status: "completed",
        data: { embedUrl },
        completedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        taskId: task.id,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      };
    }
  }

  private mapActionToTool(action: string): string {
    const toolName = ACTION_TO_TOOL_MAP[action];

    if (!toolName) {
      if (action === 'generateEmbedUrl') {
        return 'internal_embed_url';
      }

      throw new Error(`Unknown action: ${action}. Cannot map to Figma MCP tool.`);
    }

    return toolName;
  }

  prepareToolArguments(task: MCPTask): Record<string, any> {
    const { action, payload } = task;

    type PayloadWithProperties = Record<string, unknown> & {
      properties?: {
        width?: number;
        height?: number;
        x?: number;
        y?: number;
        fill?: string;
        text?: string;
        fontSize?: number;
        fontFamily?: string;
      };
      options?: {
        scale?: number;
      };
    };

    const typedPayload = payload as PayloadWithProperties;

    const args = {
      fileKey: payload.fileKey || this.fileKey,
      ...payload
    };

    switch (action) {
      case 'createElement':
      case 'createRectangle':
        return {
          fileKey: args.fileKey,
          type: payload.elementType || 'RECTANGLE',
          properties: {
            width: typedPayload.properties?.width || 100,
            height: typedPayload.properties?.height || 100,
            x: typedPayload.properties?.x || 0,
            y: typedPayload.properties?.y || 0,
            fills: typedPayload.properties?.fill ? [{
              type: 'SOLID',
              color: this.hexToRgb(typedPayload.properties.fill)
            }] : undefined,
          }
        };

      case 'createText':
        return {
          fileKey: args.fileKey,
          text: typedPayload.properties?.text || 'Text',
          properties: {
            x: typedPayload.properties?.x || 0,
            y: typedPayload.properties?.y || 0,
            fontSize: typedPayload.properties?.fontSize || 16,
            fontFamily: typedPayload.properties?.fontFamily || 'Inter',
          }
        };

      case 'modifyElement':
        return {
          fileKey: args.fileKey,
          nodeId: payload.elementId,
          properties: typedPayload.properties
        };

      case 'deleteElement':
        return {
          fileKey: args.fileKey,
          nodeId: payload.elementId
        };

      case 'groupElements':
        return {
          fileKey: args.fileKey,
          nodeIds: payload.elementIds,
          name: payload.groupName
        };

      case 'exportDesign':
        return {
          fileKey: args.fileKey,
          nodeIds: payload.nodeIds,
          format: payload.format || 'PNG',
          scale: typedPayload.options?.scale || 1
        };

      case 'getFileInfo':
        return {
          fileKey: args.fileKey
        };

      case 'listElements':
        return {
          fileKey: args.fileKey,
          nodeId: payload.pageId
        };

      default:
        return args;
    }
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    } : { r: 0, g: 0, b: 0 };
  }

  async shutdown(): Promise<void> {
    this.isConnected = false;
    this.removeAllListeners();
    console.log("Figma provider shut down");
  }

  getMCPClient(): FigmaMCPClient {
    return this.mcpClient;
  }

  private async callFigmaMCPWithPrompt(fileKey: string, prompt: string, accessToken: string): Promise<any> {
    try {
      if (!accessToken) {
        throw new Error("No access token provided or token has expired");
      }

      const result = await this.mcpClient.callTools("figma_modify", {
        fileKey,
        prompt,
        accessToken
      });

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("token") &&
        (message.includes("expired") || message.includes("invalid") || message.includes("unauthorized"))) {
        this.emit("error", "Figma access token has expired or is invalid. Please re-authenticate.");
        throw new Error("Figma access token expired. Please re-authenticate with Figma.");
      }

      this.emit("error", `MCP call failed: ${message}`);
      throw new Error(`Failed to process prompt through MCP: ${message}`);
    }
  }

  private async applyChangesToFigma(fileKey: string, changes: any, accessToken: string): Promise<void> {
    try {
      this.emit("info", "Applying changes to Figma file...");

      const response = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
        method: 'POST',
        headers: {
          'X-Figma-Token': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(changes)
      });

      if (!response.ok) {
        throw new Error(`Figma API error: ${response.status} ${response.statusText}`);
      }

      this.emit("info", "Changes applied successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.emit("error", `Failed to apply changes to Figma file: ${message}`);
      throw error;
    }
  }

  private extractFileKey(input: string): string {
    const trimmed = input?.trim();

    if (!trimmed) {
      return '';
    }

    if (!trimmed.includes('/') && /^[a-zA-Z0-9]{5,}$/.test(trimmed)) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);

      const match = url.pathname.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
      if (match && match[2]) {
        return match[2];
      }

      if (url.hostname === 'embed.figma.com') {
        const embedMatch = url.pathname.match(/\/(design|proto)\/([a-zA-Z0-9]+)/);
        if (embedMatch && embedMatch[2]) {
          return embedMatch[2];
        }
      }

      if (url.hostname === 'www.figma.com' && url.pathname === '/embed' && url.searchParams.has('url')) {
        const embedUrl = url.searchParams.get('url');
        if (embedUrl) {
          const embedMatch = decodeURIComponent(embedUrl).match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
          if (embedMatch && embedMatch[2]) {
            return embedMatch[2];
          }
        }
      }
    } catch (error) {
    }

    const fallbackMatch = trimmed.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
    if (fallbackMatch && fallbackMatch[2]) {
      return fallbackMatch[2];
    }

    const lastResort = trimmed.match(/([a-zA-Z0-9]{10,})/);
    if (lastResort && lastResort[1]) {
      return lastResort[1];
    }

    return '';
  }

  private generateEmbedUrl(fileId: string, accessToken?: string, nodeId?: string): string {
    const fileKey = this.extractFileKey(fileId);

    if (!fileKey) {
      throw new Error("Invalid Figma file ID or URL");
    }

    let embedUrl = `https://embed.figma.com/proto/${fileKey}`;

    const params = new URLSearchParams();

    if (nodeId) {
      params.append('node-id', nodeId);
      params.append('starting-point-node-id', nodeId);
    }

    params.append('embed-host', 'localhost:5173');

    if (params.toString()) {
      embedUrl += `?${params.toString()}`;
    }

    return embedUrl;
  }
}