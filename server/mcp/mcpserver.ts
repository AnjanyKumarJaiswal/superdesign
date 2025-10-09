import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  CallToolResult,
  TextContent,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";
import { MCPProvider, MCPTask, MCPResult, ProviderName, ServerEvents } from "@/utils/types.js";

export class UnifiedMCPServer extends EventEmitter {
  private server: Server;
  private providers: Record<string, MCPProvider> = {};
  private activeJobs: Map<string, { task: MCPTask; startTime: number }> = new Map();
  private isInitialized = false;

  constructor() {
    super();
    
    this.server = new Server(
      {
        name: "unified-design-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.isInitialized = true;
    this.emit("initialized");
    console.log("UnifiedMCPServer initialized");
  }

  setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      return this.executeTool(name, args || {});
    });
  }

  getTools(): Tool[] {
    const baseTools: Tool[] = [
      {
        name: "design_get_providers",
        description: "Get list of available design platform providers",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "design_get_status",
        description: "Get server status and active jobs",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ];

    if (Object.keys(this.providers).length > 0) {
      baseTools.push(
        {
          name: "design_create_element",
          description: "Create a new design element (rectangle, text, image, etc.)",
          inputSchema: {
            type: "object",
            properties: {
              provider: {
                type: "string",
                enum: Object.keys(this.providers),
                description: "Design platform provider",
              },
              elementType: {
                type: "string",
                description: "Type of element to create (e.g., 'rectangle', 'text', 'image')",
              },
              properties: {
                type: "object",
                description: "Element properties (e.g., width, height, color, text content)",
              },
            },
            required: ["provider", "elementType"],
          },
        },
        {
          name: "design_modify_element",
          description: "Modify an existing design element",
          inputSchema: {
            type: "object",
            properties: {
              provider: {
                type: "string",
                enum: Object.keys(this.providers),
              },
              elementId: {
                type: "string",
                description: "ID of the element to modify",
              },
              properties: {
                type: "object",
                description: "Properties to update",
              },
            },
            required: ["provider", "elementId", "properties"],
          },
        },
        {
          name: "design_delete_element",
          description: "Delete a design element",
          inputSchema: {
            type: "object",
            properties: {
              provider: { type: "string", enum: Object.keys(this.providers) },
              elementId: { type: "string" },
            },
            required: ["provider", "elementId"],
          },
        },
        {
          name: "design_group_elements",
          description: "Group multiple design elements together",
          inputSchema: {
            type: "object",
            properties: {
              provider: { type: "string", enum: Object.keys(this.providers) },
              elementIds: {
                type: "array",
                items: { type: "string" },
                description: "Array of element IDs to group",
              },
              groupName: { type: "string", description: "Optional name for the group" },
            },
            required: ["provider", "elementIds"],
          },
        },
        {
          name: "design_export",
          description: "Export a design file",
          inputSchema: {
            type: "object",
            properties: {
              provider: { type: "string", enum: Object.keys(this.providers) },
              fileId: { type: "string" },
              format: {
                type: "string",
                enum: ["png", "jpg", "svg", "pdf"],
                description: "Export format",
              },
              options: { type: "object", description: "Additional export options" },
            },
            required: ["provider", "fileId"],
          },
        },
        {
          name: "design_get_file_info",
          description: "Get information about a design file",
          inputSchema: {
            type: "object",
            properties: {
              provider: { type: "string", enum: Object.keys(this.providers) },
              fileId: { type: "string" },
            },
            required: ["provider", "fileId"],
          },
        },
        {
          name: "design_list_elements",
          description: "List all elements in a design file",
          inputSchema: {
            type: "object",
            properties: {
              provider: { type: "string", enum: Object.keys(this.providers) },
              fileId: { type: "string" },
              pageId: { type: "string", description: "Optional page ID to filter elements" },
            },
            required: ["provider", "fileId"],
          },
        }
      );
    }

    return baseTools;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    try {
      switch (name) {
        case "design_get_providers":
          return this.handleGetProviders();

        case "design_get_status":
          return this.handleGetStatus();

        case "design_create_element":
          return this.handleCreateElement(args);

        case "design_modify_element":
          return this.handleModifyElement(args);

        case "design_delete_element":
          return this.handleDeleteElement(args);

        case "design_group_elements":
          return this.handleGroupElements(args);

        case "design_export":
          return this.handleExport(args);

        case "design_get_file_info":
          return this.handleGetFileInfo(args);

        case "design_list_elements":
          return this.handleListElements(args);

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  handleGetProviders(): CallToolResult {
    const providers = Object.keys(this.providers).map(name => ({
      name,
      providerName: this.providers[name].providerName,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ providers }, null, 2),
        } as TextContent,
      ],
    };
  }

  getProviders(): string[] {
    return Object.keys(this.providers);
  }

  getProvider(name: string): MCPProvider | undefined {
    return this.providers[name];
  }

  handleGetStatus(): CallToolResult {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "running",
              providers: Object.keys(this.providers),
              activeJobs: this.activeJobs.size,
              uptime: process.uptime(),
            },
            null,
            2
          ),
        } as TextContent,
      ],
    };
  }

  async handleCreateElement(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, elementType, properties } = args;

    if (!provider || typeof provider !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid provider");
    }
    if (!elementType || typeof elementType !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid elementType");
    }

    const task: MCPTask = {
      id: `create-${Date.now()}`,
      provider: provider as ProviderName,
      action: `create${elementType.charAt(0).toUpperCase() + elementType.slice(1)}`,
      payload: { ...(properties as Record<string, unknown> || {}) },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) } as TextContent,
      ],
    };
  }

  async handleModifyElement(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, elementId, properties } = args;

    if (!provider || typeof provider !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid provider");
    }
    if (!elementId || typeof elementId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid elementId");
    }

    const task: MCPTask = {
      id: `modify-${Date.now()}`,
      provider: provider as ProviderName,
      action: "modifyElement",
      payload: { elementId, ...(properties as Record<string, unknown> || {}) },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) } as TextContent,
      ],
    };
  }

  async handleDeleteElement(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, elementId } = args;

    if (!provider || typeof provider !== "string" || !elementId || typeof elementId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid parameters");
    }

    const task: MCPTask = {
      id: `delete-${Date.now()}`,
      provider: provider as ProviderName,
      action: "deleteElement",
      payload: { elementId },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) } as TextContent,
      ],
    };
  }

  async handleGroupElements(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, elementIds, groupName } = args;

    if (!provider || typeof provider !== "string" || !elementIds || !Array.isArray(elementIds)) {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid parameters");
    }

    const task: MCPTask = {
      id: `group-${Date.now()}`,
      provider: provider as ProviderName,
      action: "groupElements",
      payload: { elementIds, groupName: groupName || `Group ${Date.now()}` },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) } as TextContent,
      ],
    };
  }

  async handleExport(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, fileId, format, options } = args;

    if (!provider || typeof provider !== "string" || !fileId || typeof fileId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid parameters");
    }

    const task: MCPTask = {
      id: `export-${Date.now()}`,
      provider: provider as ProviderName,
      action: "exportDesign",
      payload: { fileId, format: format || "png", ...(options as Record<string, unknown> || {}) },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result, null, 2) } as TextContent,
      ],
    };
  }

  async handleGetFileInfo(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, fileId } = args;

    if (!provider || typeof provider !== "string" || !fileId || typeof fileId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid parameters");
    }

    const task: MCPTask = {
      id: `fileinfo-${Date.now()}`,
      provider: provider as ProviderName,
      action: "getFileInfo",
      payload: { fileId },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result.data || {}, null, 2) } as TextContent,
      ],
    };
  }

  async handleListElements(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, fileId, pageId } = args;

    if (!provider || typeof provider !== "string" || !fileId || typeof fileId !== "string") {
      throw new McpError(ErrorCode.InvalidParams, "Missing or invalid parameters");
    }

    const task: MCPTask = {
      id: `list-${Date.now()}`,
      provider: provider as ProviderName,
      action: "listElements",
      payload: { fileId, pageId },
      metadata: { createdAt: Date.now() },
    };

    const result = await this.execute(task);
    return {
      content: [
        { type: "text", text: JSON.stringify(result.data || { elements: [] }, null, 2) } as TextContent,
      ],
    };
  }
  async execute(task: MCPTask): Promise<MCPResult> {
    const provider = this.providers[task.provider];

    if (!provider) {
      const errorResult: MCPResult = {
        taskId: task.id,
        status: "failed",
        error: `No provider registered for ${task.provider}`,
        completedAt: Date.now(),
      };

      this.emit("taskError", {
        provider: task.provider,
        task,
        error: errorResult.error,
      });

      return errorResult;
    }

    this.activeJobs.set(task.id, { task, startTime: Date.now() });
    this.emit("taskStart", { provider: task.provider, task });

    try {
      const result = await provider.runTask(task);
      result.completedAt = Date.now();
      this.activeJobs.delete(task.id);
      this.emit("taskComplete", { provider: task.provider, task, result });
      return result;
    } catch (error) {
      this.activeJobs.delete(task.id);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorResult: MCPResult = {
        taskId: task.id,
        status: "failed",
        error: errorMessage,
        completedAt: Date.now(),
      };
      this.emit("taskError", { provider: task.provider, task, error: errorMessage });
      return errorResult;
    }
  }

  async registerProvider(name: string, provider: MCPProvider): Promise<void> {
    if (provider.initialize) {
      await provider.initialize();
    }

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

    console.log(`Registered provider: ${name}`);
  }

  async unregisterProvider(name: string): Promise<void> {
    const provider = this.providers[name];
    if (provider) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
      provider.removeAllListeners();
      delete this.providers[name];
      console.log(`Unregistered provider: ${name}`);
    }
  }

  async start(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    this.isInitialized = true;
    this.emit("initialized");
    console.error("UnifiedMCPServer started on stdio");
  }


  async shutdown(): Promise<void> {
    console.log("Shutting down UnifiedMCPServer...");

    const providerNames = Object.keys(this.providers);
    await Promise.all(providerNames.map(name => this.unregisterProvider(name)));

    await this.server.close();
    this.isInitialized = false;
    this.emit("shutdown");
    console.log("UnifiedMCPServer shut down");
  }

  /**
   * Get active jobs info
   */
  getActiveJobs(): Record<string, { taskId: string; provider: string; action: string; duration: number }> {
    const jobs: Record<string, { taskId: string; provider: string; action: string; duration: number }> = {};

    for (const [id, jobInfo] of this.activeJobs.entries()) {
      jobs[id] = {
        taskId: jobInfo.task.id,
        provider: jobInfo.task.provider,
        action: jobInfo.task.action,
        duration: Date.now() - jobInfo.startTime,
      };
    }

    return jobs;
  }
}