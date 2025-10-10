// figma-mcp-client.ts
// A specialized client for communicating with Figma's MCP Server

import { EventEmitter } from "events";

/**
 * FigmaMCPClient - A specialized client for the Figma Model Context Protocol
 * This client handles the JSON-RPC communication with Figma's MCP server
 */
export class FigmaMCPClient extends EventEmitter {
  private baseUrl: string;
  private requestId = 0;
  private connected = false;
  private accessToken?: string;
  
  /**
   * Create a new Figma MCP client
   * @param options Configuration options
   */
  constructor(options: {
    baseUrl?: string;
    accessToken?: string;
  } = {}) {
    super();
    
    // Use provided options or environment variables
    this.baseUrl = options.baseUrl || process.env.FIGMA_MCP_URL || 'https://mcp.figma.com/mcp';
    this.accessToken = options.accessToken || process.env.FIGMA_ACCESS_TOKEN;
    
    console.log('Initialized FigmaMCPClient with baseUrl:', this.baseUrl);
  }

  /**
   * Send a JSON-RPC request to Figma's MCP Server
   */
  async sendRequest(method: string, params?: any): Promise<any> {
    const requestId = ++this.requestId;
    const requestBody = {
      jsonrpc: '2.0',
      id: requestId,
      method,
      params: params || {}
    };
    
    // Create a safe preview of parameters
    const paramsString = params ? JSON.stringify(params) : '{}';
    const paramsPreview = paramsString.substring(0, 100) + (paramsString.length > 100 ? '...' : '');
    
    console.log(`Sending MCP request to ${this.baseUrl}:`, {
      method,
      id: requestId,
      paramsPreview
    });
    
    try {
      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Add access token if available
      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }
      
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log(`MCP response status for request ${requestId}: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`MCP request failed (${response.status}): ${errorText}`);
      }

      const data = await response.json() as {
        error?: { message: string; code: number };
        result?: any;
      };

      if (data.error) {
        throw new Error(`MCP Error (code ${data.error.code}): ${data.error.message}`);
      }
      
      console.log(`MCP request ${requestId} succeeded`);
      this.connected = true;
      return data.result;
    } catch (error) {
      console.error(`MCP request ${requestId} failed:`, error);
      throw error;
    }
  }

  /**
   * Check if the MCP server is available
   */
  async ping(): Promise<boolean> {
    try {
      // First try the health endpoint
      console.log(`Attempting to ping Figma MCP server health endpoint at ${this.baseUrl}/health`);
      try {
        const healthResponse = await fetch(`${this.baseUrl}/health`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        console.log(`Health check response status: ${healthResponse.status} ${healthResponse.statusText}`);
        
        if (healthResponse.ok) {
          this.connected = true;
          return true;
        }
      } catch (healthError) {
        console.warn("Health endpoint check failed:", healthError instanceof Error ? healthError.message : healthError);
      }
      
      // If health endpoint fails, try a simple RPC request
      console.log("Attempting to ping Figma MCP server with a JSON-RPC request");
      try {
        const result = await this.sendRequest('tools/list');
        
        if (result && Array.isArray(result.tools)) {
          this.connected = true;
          return true;
        } else {
          console.warn("Received response from MCP server but tools list is not valid");
          this.connected = false;
          return false;
        }
      } catch (rpcError) {
        console.warn("RPC ping failed:", rpcError instanceof Error ? rpcError.message : rpcError);
        this.connected = false;
        return false;
      }
    } catch (error) {
      console.error('Error pinging Figma MCP server:', error instanceof Error ? error.message : error);
      this.connected = false;
      return false;
    }
  }

  /**
   * List all available tools on the MCP server
   */
  async listTools(): Promise<any[]> {
    try {
      const result = await this.sendRequest('tools/list');
      if (!result) {
        console.warn('Received empty result from tools/list request');
        return [];
      }
      return result.tools || [];
    } catch (error) {
      console.error('Error listing MCP tools:', error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Call a tool on Figma's MCP Server
   */
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    return this.sendRequest('tools/call', {
      name: toolName,
      arguments: args
    });
  }

  /**
   * Process a user prompt via Figma's MCP Server
   */
  async processPrompt(fileKey: string, prompt: string, accessToken?: string): Promise<any> {
    try {
      console.log(`Processing prompt for file ${fileKey}: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
      
      // Use provided access token or the client's default
      const token = accessToken || this.accessToken;
      
      if (!token) {
        throw new Error("No access token provided for Figma API call");
      }
      
      // First, call the figma_analyze_prompt tool to understand the intent
      try {
        const analysis = await this.callTool('figma_analyze_prompt', {
          fileKey,
          prompt,
          accessToken: token
        });
        
        console.log('Prompt analysis:', analysis);
        
        // Based on the analysis, call the appropriate tool
        if (analysis && analysis.intent === 'create') {
          return this.callTool('figma_create_shape', {
            fileKey,
            type: analysis.elementType || 'RECTANGLE',
            properties: analysis.properties || {},
            accessToken: token
          });
        } else if (analysis && analysis.intent === 'modify') {
          return this.callTool('figma_modify_node', {
            fileKey,
            nodeId: analysis.nodeId,
            properties: analysis.properties || {},
            accessToken: token
          });
        } else if (analysis && analysis.intent === 'delete') {
          return this.callTool('figma_delete_node', {
            fileKey,
            nodeId: analysis.nodeId,
            accessToken: token
          });
        } else {
          // Default to the general figma_modify tool
          return this.callTool('figma_modify', {
            fileKey,
            prompt,
            accessToken: token
          });
        }
      } catch (analysisError) {
        console.warn("Failed to analyze prompt, falling back to general modify:", 
          analysisError instanceof Error ? analysisError.message : analysisError);
        
        // If analysis fails, fall back to the general tool
        return this.callTool('figma_modify', {
          fileKey,
          prompt,
          accessToken: token
        });
      }
    } catch (error) {
      console.error("Error processing prompt:", error instanceof Error ? error.message : error);
      throw error;
    }
  }
  
  /**
   * Get file information from Figma
   */
  async getFileInfo(fileKey: string, accessToken?: string): Promise<any> {
    const token = accessToken || this.accessToken;
    
    if (!token) {
      throw new Error("No access token provided for Figma API call");
    }
    
    return this.callTool('figma_get_file', {
      fileKey,
      accessToken: token
    });
  }
  
  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Set access token for subsequent requests
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
  }
}