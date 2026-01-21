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

    const mcpUrl = config?.mcpServerUrl || 'http://127.0.0.1:3845/sse';

    this.mcpClient = new FigmaMCPClient(
      mcpUrl,
      config?.accessToken || process.env.FIGMA_ACCESS_TOKEN
    );

    this.fileKey = config?.defaultFileKey || process.env.FIGMA_DEFAULT_FILE_KEY;
    this.hostUrl = config?.hostUrl || process.env.CLIENT_URL || 'http://localhost:5173';

    console.log(`FigmaProvider initialized with MCP URL: ${mcpUrl}, Host URL: ${this.hostUrl}`);
  }

  private emitInfo(message: string): void {
    console.log(message);
    this.emit("info", message);
  }

  private emitError(message: string, error?: Error): void {
    console.error(message, error);
    this.emit("error", message);
  }

  private emitTaskProgress(task: MCPTask, progress: string, data?: any): void {
    this.emit("taskProgress", { task, progress, data });
  }

  async initialize(): Promise<void> {
    try {

      const isAlive = await this.mcpClient.ping().catch(() => false);

      if (!isAlive) {
        this.isConnected = false;
        this.emitInfo("Figma provider initialized in embed-only mode");
        return;
      }

      const tools = await this.mcpClient.listTools().catch(() => []);
      this.isConnected = tools.length > 0;

      if (this.isConnected) {
        // Connection successful, tools loaded silently
      } else {
        this.emitInfo("Connected to Figma MCP Server but no tools available");
      }
    } catch (error) {
      this.isConnected = false;
      this.emitInfo(`Figma provider initialized in embed-only mode: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  async getEmbedUrl(fileId: string, accessToken?: string): Promise<string> {
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
  }

  isReady(): boolean {
    return this.isConnected;
  }


  private ensureConnected(task: MCPTask): void {
    if (!this.isConnected && task.action !== 'generateEmbedUrl') {
      throw new Error("Figma provider not connected. Call initialize() first.");
    }
  }

  async runTask(task: MCPTask): Promise<MCPResult> {
    this.emit("taskStart", task);

    try {
      this.ensureConnected(task);

      if (task.action === 'processPrompt') {
        return this.handlePromptTask(task);
      }

      if (task.action === 'generateEmbedUrl') {
        return this.handleEmbedUrlTask(task);
      }

      return this.handleMCPToolTask(task);

    } catch (error) {
      return this.createErrorResult(task, error);
    }
  }

  private async handleMCPToolTask(task: MCPTask): Promise<MCPResult> {
    const toolName = this.mapActionToTool(task.action);

    this.emitTaskProgress(task, `Calling Figma MCP tool: ${toolName}`, {
      tool: toolName,
      action: task.action
    });

    const toolArgs = this.prepareToolArguments(task);
    const mcpResult = await this.mcpClient.callTool(toolName, toolArgs);

    this.emitTaskProgress(task, "Processing Figma response...", { result: mcpResult });

    const result: MCPResult = {
      taskId: task.id,
      status: "completed",
      data: mcpResult,
      completedAt: Date.now(),
    };

    this.emit("taskComplete", { task, result });
    return result;
  }

  private async handlePromptTask(task: MCPTask): Promise<MCPResult> {
    const { fileId, prompt } = task.payload as { fileId: string; prompt: string };

    if (!fileId || !prompt) {
      throw new Error("Missing required parameters: fileId and prompt");
    }

    const truncatedPrompt = prompt.length > 50 ? `${prompt.substring(0, 50)}...` : prompt;
    this.emitTaskProgress(task, `Processing prompt: "${truncatedPrompt}"`);

    const fileKey = this.extractFileKey(fileId);
    const result = await this.mcpClient.processPrompt(fileKey, prompt);

    return {
      taskId: task.id,
      status: "completed",
      data: result,
      completedAt: Date.now(),
    };
  }

  private async handleEmbedUrlTask(task: MCPTask): Promise<MCPResult> {
    const { fileId, nodeId, accessToken } = task.payload as {
      fileId: string;
      nodeId?: string;
      accessToken?: string;
    };

    if (!fileId) {
      throw new Error("Missing required parameter: fileId");
    }

    this.emitTaskProgress(task, `Generating embed URL for file: ${fileId}`);
    const embedUrl = this.generateEmbedUrl(fileId, accessToken, nodeId);

    return {
      taskId: task.id,
      status: "completed",
      data: { embedUrl },
      completedAt: Date.now(),
    };
  }

  private createErrorResult(task: MCPTask, error: unknown): MCPResult {
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

    const actionHandlers: Record<string, () => Record<string, any>> = {
      'createElement': () => this.createElementArgs(typedPayload, args),
      'createRectangle': () => this.createElementArgs(typedPayload, args),
      'createText': () => this.createTextArgs(typedPayload, args),
      'modifyElement': () => ({
        fileKey: args.fileKey,
        nodeId: payload.elementId,
        properties: typedPayload.properties
      }),
      'deleteElement': () => ({
        fileKey: args.fileKey,
        nodeId: payload.elementId
      }),
      'groupElements': () => ({
        fileKey: args.fileKey,
        nodeIds: payload.elementIds,
        name: payload.groupName
      }),
      'exportDesign': () => ({
        fileKey: args.fileKey,
        nodeIds: payload.nodeIds,
        format: payload.format || 'PNG',
        scale: typedPayload.options?.scale || 1
      }),
      'getFileInfo': () => ({ fileKey: args.fileKey }),
      'listElements': () => ({
        fileKey: args.fileKey,
        nodeId: payload.pageId
      })
    };

    const handler = actionHandlers[action];
    return handler ? handler() : args;
  }

  private createElementArgs(payload: any, args: any): Record<string, any> {
    return {
      fileKey: args.fileKey,
      type: payload.elementType || 'RECTANGLE',
      properties: {
        width: payload.properties?.width || 100,
        height: payload.properties?.height || 100,
        x: payload.properties?.x || 0,
        y: payload.properties?.y || 0,
        fills: payload.properties?.fill ? [{
          type: 'SOLID',
          color: this.hexToRgb(payload.properties.fill)
        }] : undefined,
      }
    };
  }

  private createTextArgs(payload: any, args: any): Record<string, any> {
    return {
      fileKey: args.fileKey,
      text: payload.properties?.text || 'Text',
      properties: {
        x: payload.properties?.x || 0,
        y: payload.properties?.y || 0,
        fontSize: payload.properties?.fontSize || 16,
        fontFamily: payload.properties?.fontFamily || 'Inter',
      }
    };
  }

  hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1] || '0', 16) / 255,
      g: parseInt(result[2] || '0', 16) / 255,
      b: parseInt(result[3] || '0', 16) / 255,
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

  private extractFileKey(input: string): string {
    const trimmed = input?.trim();
    if (!trimmed) return '';

    if (!trimmed.includes('/') && /^[a-zA-Z0-9]{5,}$/.test(trimmed)) {
      return trimmed;
    }

    try {
      const url = new URL(trimmed);
      return this.extractFromURL(url);
    } catch {
      return this.extractWithRegex(trimmed);
    }
  }

  private extractFromURL(url: URL): string {
    if (url.hostname === 'embed.figma.com') {
      const match = url.pathname.match(/\/(design|proto)\/([a-zA-Z0-9]+)/);
      if (match?.[2]) return match[2];
    }

    if (url.hostname === 'www.figma.com' && url.pathname === '/embed') {
      const embedUrl = url.searchParams.get('url');
      if (embedUrl) {
        const match = decodeURIComponent(embedUrl).match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
        if (match?.[2]) return match[2];
      }
    }

    const match = url.pathname.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
    if (match?.[2]) return match[2];

    return '';
  }

  private extractWithRegex(input: string): string {
    const standardMatch = input.match(/\/(file|design|proto)\/([a-zA-Z0-9]+)/);
    if (standardMatch?.[2]) return standardMatch[2];

    const lastResort = input.match(/([a-zA-Z0-9]{10,})/);
    return lastResort?.[1] || '';
  }

  private generateEmbedUrl(fileId: string, accessToken?: string, nodeId?: string): string {
    const fileKey = this.extractFileKey(fileId);

    if (!fileKey) {
      throw new Error("Invalid Figma file ID or URL");
    }

    const params = new URLSearchParams();

    if (nodeId) {
      params.append('node-id', nodeId);
      params.append('starting-point-node-id', nodeId);
    }

    params.append('embed-host', 'localhost:5173');

    const queryString = params.toString();
    return `https://embed.figma.com/proto/${fileKey}${queryString ? `?${queryString}` : ''}`;
  }
}