import express from 'express';
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
import type { MCPProvider, MCPTask, MCPResult, ProviderName } from "@/types";

export class UnifiedMCPServer extends EventEmitter {
  private server: Server;
  private httpServer?: any;
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

  async startHTTP(port: number = 3845): Promise<void> {
    const app = express();
    app.use(express.json());

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        server: 'unified-design-mcp-server',
        version: '1.0.0',
        providers: Object.keys(this.providers),
        initialized: this.isInitialized,
        timestamp: new Date().toISOString()
      });
    });

    app.post('/mcp', async (req, res) => {
      const { jsonrpc, id, method, params } = req.body;

      console.log(`[MCP HTTP] Received request:`, { id, method, params });

      if (jsonrpc !== '2.0') {
        return res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid Request: jsonrpc must be "2.0"'
          },
          id: id || null
        });
      }

      try {
        let result: any;

        switch (method) {
          case 'initialize':
            result = await this.handleInitialize(params);
            break;

          case 'tools/list':
            result = { tools: this.getTools() };
            break;

          case 'tools/call':
            if (!params?.name) {
              throw new Error('Missing tool name in tools/call');
            }
            const toolResult = await this.executeTool(params.name, params.arguments || {});
            result = toolResult;
            break;

          case 'shutdown':
            result = { success: true };
            setTimeout(() => this.shutdown(), 1000);
            break;

          default:
            throw new Error(`Unknown method: ${method}`);
        }

        res.json({
          jsonrpc: '2.0',
          result,
          id
        });

      } catch (error) {
        console.error(`[MCP HTTP] Error handling ${method}:`, error);
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: error instanceof Error ? error.message : 'Unknown error',
            data: error instanceof Error ? error.stack : undefined
          },
          id: id || null
        });
      }
    });

    return new Promise((resolve) => {
      this.httpServer = app.listen(port, () => {
        console.log(`\n✅ MCP HTTP Server listening on http://127.0.0.1:${port}/mcp`);
        console.log(`   Health endpoint: http://127.0.0.1:${port}/health`);
        resolve();
      });
    });
  }

  private async handleInitialize(params: any): Promise<any> {
    console.log('[MCP] Initialize request with params:', params);

    if (!params || !params.protocolVersion) {
      console.warn('[MCP] Initialize called without protocolVersion, using default');
    }

    await this.initialize();

    return {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'unified-design-mcp-server',
        version: '1.0.0'
      },
      capabilities: {
        tools: {},
        roots: { listChanged: true },
        sampling: {}
      }
    };
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
          description: "Create a new design element using a registered provider",
          inputSchema: {
            type: "object",
            properties: {
              provider: {
                type: "string",
                enum: Object.keys(this.providers),
                description: "The provider to use for creating the element"
              },
              elementType: {
                type: "string",
                description: "Type of element to create (e.g., 'rectangle', 'text', 'frame')"
              },
              properties: {
                type: "object",
                description: "Properties for the element (e.g., dimensions, colors, text content)"
              },
              fileKey: {
                type: "string",
                description: "File key or ID where the element should be created"
              }
            },
            required: ["provider", "elementType"],
          },
        },
        {
          name: "design_process_prompt",
          description: "Process a natural language prompt to create or modify design elements",
          inputSchema: {
            type: "object",
            properties: {
              provider: {
                type: "string",
                enum: Object.keys(this.providers),
                description: "The provider to use"
              },
              fileKey: {
                type: "string",
                description: "File key or ID to work with"
              },
              prompt: {
                type: "string",
                description: "Natural language description of what to create or modify"
              },
              accessToken: {
                type: "string",
                description: "Access token for the design platform API"
              }
            },
            required: ["provider", "fileKey", "prompt"],
          },
        }
      );
    }

    return baseTools;
  }

  async executeTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    try {
      console.log(`[MCP] Executing tool: ${name} with args:`, args);

      switch (name) {
        case "design_get_providers":
          return this.handleGetProviders();

        case "design_get_status":
          return this.handleGetStatus();

        case "design_create_element":
          return await this.handleCreateElement(args);

        case "design_process_prompt":
          return await this.handleProcessPrompt(args);

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    } catch (error) {
      console.error(`[MCP] Error executing tool ${name}:`, error);
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  private async handleCreateElement(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, elementType, properties, fileKey } = args;

    if (!provider || typeof provider !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid provider parameter');
    }

    if (!elementType || typeof elementType !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid elementType parameter');
    }

    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new McpError(ErrorCode.InvalidParams, `Provider '${provider}' not found`);
    }

    const task: MCPTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider: provider as ProviderName,
      action: 'create',
      payload: {
        elementType,
        properties: properties || {},
        fileKey
      },
      parameters: {
        elementType,
        properties: properties || {},
        fileKey
      },
      timestamp: Date.now()
    };

    const result = await this.execute(task);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        } as TextContent,
      ],
    };
  }

  private async handleProcessPrompt(args: Record<string, unknown>): Promise<CallToolResult> {
    const { provider, fileKey, prompt, accessToken } = args;

    if (!provider || typeof provider !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid provider parameter');
    }

    if (!fileKey || typeof fileKey !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid fileKey parameter');
    }

    if (!prompt || typeof prompt !== 'string') {
      throw new McpError(ErrorCode.InvalidParams, 'Missing or invalid prompt parameter');
    }

    const providerInstance = this.providers[provider];
    if (!providerInstance) {
      throw new McpError(ErrorCode.InvalidParams, `Provider '${provider}' not found`);
    }

    const task: MCPTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      provider: provider as ProviderName,
      action: 'process_prompt',
      payload: {
        fileKey,
        prompt,
        accessToken
      },
      parameters: {
        fileKey,
        prompt,
        accessToken
      },
      timestamp: Date.now()
    };

    const result = await this.execute(task);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        } as TextContent,
      ],
    };
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
              initialized: this.isInitialized,
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
    try {
      if (provider.initialize) {
        try {
          await provider.initialize();
          console.log(`Provider ${name} initialized successfully`);
        } catch (initError) {
          console.warn(`Provider ${name} initialization failed but will continue:`, initError);
        }
      }

      this.providers[name] = provider;

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
    } catch (error) {
      console.error(`Failed to register provider ${name}:`, error);
      throw error;
    }
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

    if (this.httpServer) {
      this.httpServer.close();
      console.log("HTTP server closed");
    }

    const providerNames = Object.keys(this.providers);
    await Promise.all(providerNames.map(name => this.unregisterProvider(name)));

    await this.server.close();
    this.isInitialized = false;
    this.emit("shutdown");
    console.log("UnifiedMCPServer shut down");
  }

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