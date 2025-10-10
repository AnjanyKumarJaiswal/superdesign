import { EventEmitter } from "events";
import type { MCPProvider, MCPResult, MCPTask } from "@/utils/types";
import { FigmaMCPClient } from "@/mcp/figma-mcp-client";
import { analyzeEmbedUrl, fixEmbedUrl, getEmbedDebugInfo } from "@/utils/embedUrlHelper";

// Action to Figma MCP tool mapping
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
  'processPrompt': 'figma_modify', // Added for prompt-based processing
  'analyzePrompt': 'figma_analyze_prompt', // For analyzing the user's prompt intent
};

export class FigmaProvider extends EventEmitter implements MCPProvider {
  readonly providerName = "figma";
  private mcpClient: FigmaMCPClient;
  private isConnected = false;
  private fileKey?: string; // Default Figma file to work with
  private hostUrl: string = 'http://localhost:5173';

  constructor(config?: { 
    mcpServerUrl?: string; 
    defaultFileKey?: string;
    hostUrl?: string;
    accessToken?: string;
  }) {
    super();
    
    // Use environment variables as fallbacks
    const mcpUrl = config?.mcpServerUrl || process.env.FIGMA_MCP_URL || 'https://mcp.figma.com/mcp';
    
    // Initialize with options object
    this.mcpClient = new FigmaMCPClient({
      baseUrl: mcpUrl,
      accessToken: config?.accessToken || process.env.FIGMA_ACCESS_TOKEN
    });
    
    this.fileKey = config?.defaultFileKey || process.env.FIGMA_DEFAULT_FILE_KEY;
    
    // Host URL for embed iframe
    this.hostUrl = config?.hostUrl || process.env.CLIENT_URL || 'http://localhost:5173';
    
    console.log(`FigmaProvider initialized with MCP URL: ${mcpUrl}, Host URL: ${this.hostUrl}`);
  }

  /**
   * Initialize and verify connection to Figma's MCP Server
   */
  async initialize(): Promise<void> {
    try {
      console.log("Initializing Figma provider and attempting to connect to MCP server...");
      this.emit("info", "Connecting to Figma MCP Server...");
      
      // First check - ping the health endpoint
      let isAlive = false;
      try {
        console.log("Checking Figma MCP server health...");
        isAlive = await this.mcpClient.ping();
        console.log(`Ping result: ${isAlive ? 'Success' : 'Failed'}`);
      } catch (pingError) {
        console.warn("Failed to ping Figma MCP Server:", pingError);
        console.warn("Continuing in embed-only mode");
      }
      
      if (!isAlive) {
        console.warn("Figma MCP Server is not responding, initializing in embed-only mode");
        // Set a limited connected state that only supports embed functionality
        this.isConnected = false;
        this.emit("info", "Figma provider initialized in embed-only mode");
        
        // Important: We're still operational for embed URLs even if the MCP server is down
        console.log("Figma provider will still generate embed URLs, but design operations will not be available");
        return;
      }

      // Second check - try to list tools to verify full connection
      try {
        console.log("Attempting to list available tools from Figma MCP server...");
        const tools = await this.mcpClient.listTools();
        this.isConnected = true;
        
        if (Array.isArray(tools) && tools.length > 0) {
          console.log(`Successfully connected to Figma MCP server. Found ${tools.length} tools.`);
          this.emit("info", `Connected to Figma MCP Server. Available tools: ${tools.length}`);
          console.log("Figma MCP tools:", tools.map(t => t.name).join(", "));
        } else {
          console.warn("Connected to Figma MCP server but no tools were returned");
          this.emit("info", "Connected to Figma MCP Server but no tools available");
        }
      } catch (toolsError) {
        console.warn("Failed to list Figma MCP tools:", toolsError);
        console.warn("Continuing in embed-only mode");
        this.isConnected = false;
      }
      
      if (this.isConnected) {
        console.log("✅ Figma provider initialized successfully with full MCP functionality");
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
  
  /**
   * Get Figma Embed URL for a file
   */
  async getEmbedUrl(fileId: string, accessToken: string): Promise<string> {
    try {
      if (!fileId) {
        throw new Error("File ID is required to generate embed URL");
      }
      
      this.emit("info", `Generating embed URL for file: ${fileId} with auth token: ${accessToken ? '✓ Present' : '✗ Missing'}`);
      
      // Get client domain information
      const domain = process.env.CLIENT_DOMAIN || this.hostUrl.replace(/^https?:\/\//, '').split(':')[0];
      this.emit("info", `Using domain for embed_host: ${domain}`);
      
      // Extract the file key for better error messages
      const fileKey = this.extractFileKey(fileId);
      if (!fileKey) {
        throw new Error(`Could not extract a valid file key from: ${fileId}`);
      }
      
      this.emit("info", `Extracted file key: ${fileKey}`);
      
      // Use our updated generateEmbedUrl method with the access token
      const embedUrl = this.generateEmbedUrl(fileId, accessToken);
      
      // Analyze the URL for potential issues
      const analysis = analyzeEmbedUrl(embedUrl);
      if (!analysis.valid) {
        const issues = analysis.issues.join(", ");
        this.emit("warning", `Generated embed URL has issues: ${issues}`);
      }
      
      this.emit("info", `Embed URL generated successfully: ${embedUrl}`);
      
      return embedUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.emit("error", `Failed to generate Figma embed URL: ${message}`);
      throw error;
    }
  }

  /**
   * Check if provider is ready
   */
  isReady(): boolean {
    return this.isConnected;
  }

  /**
   * Main task execution - translates your task format to Figma MCP calls
   */
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
      // Special handling for prompt-based tasks
      if (task.action === 'processPrompt') {
        return this.handlePromptTask(task);
      }
      
      // Special handling for embed URL generation (works even without MCP connection)
      if (task.action === 'generateEmbedUrl') {
        return this.handleEmbedUrlTask(task);
      }
      
      // Map your action to Figma's MCP tool name
      const toolName = this.mapActionToTool(task.action);
      
      this.emit("taskProgress", { 
        task, 
        progress: `Calling Figma MCP tool: ${toolName}`,
        data: { tool: toolName, action: task.action }
      });

      // Prepare arguments for Figma's MCP server
      const toolArgs = this.prepareToolArguments(task);

      // Call Figma's MCP Server
      const mcpResult = await this.mcpClient.callTool(toolName, toolArgs);

      this.emit("taskProgress", { 
        task, 
        progress: "Processing Figma response...",
        data: { result: mcpResult }
      });

      // Transform Figma's response to your result format
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
  
  /**
   * Handle prompt-based task execution
   */
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
      
      // Extract file key if URL was provided
      const fileKey = this.extractFileKey(fileId);
      
      // Process the prompt using MCP client
      const result = await this.mcpClient.processPrompt(fileKey, prompt, accessToken as string);
      
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
  
  /**
   * Handle embed URL generation task (works without MCP connection)
   */
  private async handleEmbedUrlTask(task: MCPTask): Promise<MCPResult> {
    try {
      const { fileId, nodeId } = task.payload as {
        fileId: string;
        nodeId?: string;
      };
      
      if (!fileId) {
        throw new Error("Missing required parameter: fileId");
      }
      
      this.emit("taskProgress", { 
        task, 
        progress: `Generating embed URL for file: ${fileId}`,
      });
      
      // Generate the embed URL
      const embedUrl = this.generateEmbedUrl(fileId, nodeId);
      
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

  /**
   * Map your generic action to Figma's specific MCP tool
   */
  private mapActionToTool(action: string): string {
    const toolName = ACTION_TO_TOOL_MAP[action];
    
    if (!toolName) {
      // Special handling for embed URL generation which doesn't require MCP
      if (action === 'generateEmbedUrl') {
        return 'internal_embed_url'; // This is handled internally
      }
      
      throw new Error(`Unknown action: ${action}. Cannot map to Figma MCP tool.`);
    }
    
    return toolName;
  }

  /**
   * Prepare arguments in the format Figma's MCP server expects
   */
  prepareToolArguments(task: MCPTask): Record<string, any> {
    const { action, payload } = task;
    
    // Cast payload properties to the expected types
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
    
    // Add file key if not provided
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

  /**
   * Process a user prompt and apply changes to a Figma file
   * @param fileId Figma file ID
   * @param prompt User's natural language prompt
   * @param accessToken Figma access token
   */
  async processUserPrompt(fileId: string, prompt: string, accessToken: string): Promise<any> {
    if (!this.isConnected) {
      this.emit("warn", "Processing in limited mode as MCP server is not connected");
    }
    
    this.emit("info", `Processing user prompt: "${prompt}" for file ${fileId}`);
    
    try {
      // First, extract the file key if a full URL was provided
      const fileKey = this.extractFileKey(fileId);
      
      if (!fileKey) {
        throw new Error("Invalid Figma file ID or URL");
      }
      
      // Create a task to handle the user prompt
      const taskId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      this.emit("taskStart", {
        id: taskId,
        provider: this.providerName,
        action: "processPrompt",
        payload: { 
          fileKey,
          prompt,
          accessToken: "***" // Mask token in logs
        }
      });
      
      // If connected to MCP server, use it to process the prompt
      if (this.isConnected) {
        // Call the appropriate Figma MCP tool based on prompt analysis
        const mcpResult = await this.callFigmaMCPWithPrompt(fileKey, prompt, accessToken);
        
        this.emit("info", "MCP server processed the prompt successfully");
        
        // Apply any changes returned from the MCP server to the Figma file
        if (mcpResult && mcpResult.changes) {
          await this.applyChangesToFigma(fileKey, mcpResult.changes, accessToken);
        }
        
        return {
          success: true,
          taskId,
          fileKey,
          changes: mcpResult?.changes || {},
          message: "Prompt processed and changes applied to Figma file"
        };
      } else {
        // If not connected to MCP, we can still generate an embed URL
        this.emit("warn", "MCP server not available, returning embed URL only");
        
        const embedUrl = this.generateEmbedUrl(fileId);
        
        return {
          success: false,
          taskId,
          fileKey,
          embedUrl,
          message: "MCP server not available. Generated embed URL only."
        };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      this.emit("error", `Failed to process user prompt: ${message}`);
      
      // Still try to return an embed URL even if processing failed
      try {
        const embedUrl = this.generateEmbedUrl(fileId);
        return {
          success: false,
          error: message,
          embedUrl
        };
      } catch {
        return {
          success: false,
          error: message
        };
      }
    }
  }
  
  /**
   * Call Figma's MCP server with the user prompt
   */
  private async callFigmaMCPWithPrompt(fileKey: string, prompt: string, accessToken: string): Promise<any> {
    try {
      // Check if the token is valid before attempting the call
      if (!accessToken) {
        throw new Error("No access token provided or token has expired");
      }
      
      const result = await this.mcpClient.callTool("figma_modify", {
        fileKey,
        prompt,
        accessToken
      });
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      
      // Check for token expiration errors
      if (message.includes("token") && 
         (message.includes("expired") || message.includes("invalid") || message.includes("unauthorized"))) {
        this.emit("error", "Figma access token has expired or is invalid. Please re-authenticate.");
        throw new Error("Figma access token expired. Please re-authenticate with Figma.");
      }
      
      this.emit("error", `MCP call failed: ${message}`);
      throw new Error(`Failed to process prompt through MCP: ${message}`);
    }
  }
  
  /**
   * Apply changes to a Figma file using the Figma API
   */
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

  /**
   * Extract file key from Figma URL or use as-is if already a key
   */
  private extractFileKey(input: string): string {
    console.log('Extracting file key from input:', input);
    // Trim the input to avoid whitespace issues
    const trimmed = input?.trim();
    
    if (!trimmed) {
      console.warn('Empty input provided to extractFileKey');
      return '';
    }
    
    // If it's a direct file key (no slashes, only alphanumeric characters)
    if (!trimmed.includes('/') && /^[a-zA-Z0-9]{5,}$/.test(trimmed)) {
      console.log('Input appears to be a direct file key:', trimmed);
      return trimmed;
    }
    
    try {
      // Check if input is a URL by attempting to parse it
      const url = new URL(trimmed);
      console.log('Input is a URL:', url.href);
      
      // Handle different Figma URL patterns
      
      // Pattern: figma.com/file/{key}/name
      const fileMatch = url.pathname.match(/\/file\/([a-zA-Z0-9]+)/);
      if (fileMatch && fileMatch[1]) {
        console.log('Extracted file key from file URL:', fileMatch[1]);
        return fileMatch[1];
      }
      
      // Pattern: figma.com/proto/{key}/name
      const protoMatch = url.pathname.match(/\/proto\/([a-zA-Z0-9]+)/);
      if (protoMatch && protoMatch[1]) {
        console.log('Extracted file key from proto URL:', protoMatch[1]);
        return protoMatch[1];
      }
      
      // Pattern: embed.figma.com/...?url=...file/{key}/...
      if (url.hostname === 'embed.figma.com' && url.searchParams.has('url')) {
        const embedUrl = url.searchParams.get('url');
        if (embedUrl) {
          const embedMatch = decodeURIComponent(embedUrl).match(/file\/([a-zA-Z0-9]+)/);
          if (embedMatch && embedMatch[1]) {
            console.log('Extracted file key from embed URL param:', embedMatch[1]);
            return embedMatch[1];
          }
        }
      }
    } catch (error) {
      // Not a valid URL, continue with regex-based extraction
      console.log('Not a valid URL, using regex extraction');
    }
    
    // Try to extract from URL pattern like https://www.figma.com/file/abcdefg/
    const fileMatch = trimmed.match(/file\/([a-zA-Z0-9]+)/);
    if (fileMatch && fileMatch[1]) {
      console.log('Extracted file key using file/ regex:', fileMatch[1]);
      return fileMatch[1];
    }
    
    // Try to extract from URL pattern like https://www.figma.com/proto/abcdefg/
    const protoMatch = trimmed.match(/proto\/([a-zA-Z0-9]+)/);
    if (protoMatch && protoMatch[1]) {
      console.log('Extracted file key using proto/ regex:', protoMatch[1]);
      return protoMatch[1];
    }
    
    // As a fallback, try to find any alphanumeric sequence that looks like a file ID
    // Figma IDs are usually at least 22 characters long, but we'll be flexible
    const fallbackMatch = trimmed.match(/([a-zA-Z0-9]{10,})/);
    if (fallbackMatch && fallbackMatch[1]) {
      console.log('Using fallback match for file ID:', fallbackMatch[1]);
      return fallbackMatch[1];
    }
    
    console.warn('Failed to extract file key from input:', trimmed);
    return '';
  }
  
  /**
   * Generate a Figma embed URL with custom parameters
   * @param fileId - The Figma file ID or URL
   * @param nodeId - Optional node ID to focus on
   * @param accessToken - Optional Figma access token for authentication
   */
  generateEmbedUrl(fileId: string, accessToken?: string, nodeId?: string): string {
    // Extract file key if URL was provided
    const fileKey = this.extractFileKey(fileId);
    
    if (!fileKey) {
      throw new Error("Invalid Figma file ID or URL");
    }
    
    // Log for debugging
    console.log(`Generating embed URL for file key: ${fileKey}`);
    
    // Base Figma URL
    const figmaUrl = `https://www.figma.com/file/${fileKey}`;
    
    // Add node ID and other parameters if provided
    const params = new URLSearchParams();
    
    if (nodeId) {
      params.append('node-id', nodeId);
    }
    
    // Create final URL with parameters
    const fullUrl = params.toString() ? `${figmaUrl}?${params.toString()}` : figmaUrl;
    
    // Create embed URL with proper domain for embed_host (not localhost)
    const embedHost = process.env.CLIENT_DOMAIN || 'superdesign.app';
    const encodedUrl = encodeURIComponent(fullUrl);
    
    // Create the embed URL
    let embedUrl = `https://www.figma.com/embed?embed_host=${embedHost}&url=${encodedUrl}`;
    
    // Fix any issues with the embed URL
    embedUrl = fixEmbedUrl(embedUrl, { domain: embedHost });
    
    // Log debug info
    const debugInfo = getEmbedDebugInfo(embedUrl);
    console.log(debugInfo);
    
    return embedUrl;
  }
}

// Usage example
/*
const figmaProvider = new FigmaProvider({
  mcpServerUrl: 'http://localhost:3001', // Figma's MCP server
  defaultFileKey: 'your-figma-file-key'
});

await figmaProvider.initialize();

const task: MCPTask = {
  id: 'task-1',
  provider: 'figma',
  action: 'createElement',
  payload: {
    elementType: 'RECTANGLE',
    properties: {
      width: 200,
      height: 100,
      fill: '#FF0000'
    }
  },
  metadata: { createdAt: Date.now() }
};

const result = await figmaProvider.runTask(task);
console.log(result);
*/