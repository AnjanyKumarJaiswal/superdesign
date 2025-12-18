import { EventEmitter } from "events";

export class FigmaMCPClient extends EventEmitter {
  private baseUrl: string;
  private requestId = 0;
  private connected = false;
  private accessToken?: string;
  private serverInfo?: any;

  constructor(options: {
    baseUrl?: string;
    accessToken?: string;
  } = {}) {
    super();

    this.baseUrl = options.baseUrl || process.env.FIGMA_MCP_URL || 'http://127.0.0.1:3845/mcp';
    this.accessToken = options.accessToken || process.env.FIGMA_ACCESS_TOKEN;

    console.log('Initialized FigmaMCPClient with baseUrl:', this.baseUrl);
  }

  async sendRequest(method: string, params?: any): Promise<any> {
    const requestId = ++this.requestId;

    const requestBody: any = {
      jsonrpc: '2.0',
      id: requestId,
      method
    };

    if (params !== undefined && params !== null) {
      if (typeof params === 'object' && Object.keys(params).length > 0) {
        requestBody.params = params;
      } else if (typeof params !== 'object') {
        requestBody.params = params;
      }
    }

    const paramsString = params ? JSON.stringify(params) : 'none';
    const paramsPreview = paramsString.substring(0, 100) + (paramsString.length > 100 ? '...' : '');

    console.log(`[MCP Request ${requestId}] ${method}`, { paramsPreview });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      };

      if (this.accessToken) {
        headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      console.log(`[MCP Response ${requestId}] Status: ${response.status} ${response.statusText}`);
      console.log(`[MCP Response ${requestId}] Content-Type: ${response.headers.get('content-type')}`);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error(`[MCP Response ${requestId}] Error body:`, errorText);
        throw new Error(`MCP request failed (${response.status}): ${errorText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        console.log(`[MCP Response ${requestId}] Received SSE stream, parsing...`);
        return await this.parseSSEResponse(response);
      }

      const data = await response.json() as {
        error?: { message: string; code: number; data?: any };
        result?: any;
      };

      if (data.error) {
        console.error(`[MCP Response ${requestId}] Error:`, data.error);
        throw new Error(`MCP Error (code ${data.error.code}): ${data.error.message}`);
      }

      console.log(`[MCP Response ${requestId}] Success`);
      this.connected = true;
      return data.result;
    } catch (error) {
      console.error(`[MCP Request ${requestId}] Failed:`, error);
      throw error;
    }
  }

  private async parseSSEResponse(response: Response): Promise<any> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body available for SSE parsing');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let result: any = null;

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const event of events) {
          if (!event.trim()) continue;

          const lines = event.split('\n');
          let eventData = '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              eventData += line.slice(6);
            }
          }

          if (eventData) {
            try {
              const parsed = JSON.parse(eventData);
              console.log('[MCP SSE] Received event:', parsed);

              if (parsed.error) {
                throw new Error(`SSE Error: ${parsed.error.message}`);
              }

              if (parsed.result !== undefined) {
                result = parsed.result;
              }

              this.emit('progress', parsed);
            } catch (parseError) {
              console.warn('[MCP SSE] Failed to parse event data:', eventData);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return result;
  }

  async ping(): Promise<boolean> {
    try {
      console.log(`[MCP] Attempting to connect to Figma MCP server at ${this.baseUrl}`);

      try {
        console.log('[MCP] Trying initialize with full MCP spec + SSE...');
        const initResult = await this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: {
            experimental: {},
            sampling: {}
          },
          clientInfo: {
            name: 'SuperDesign',
            version: '1.0.0'
          }
        });

        console.log('[MCP] Initialize successful:', initResult);
        this.serverInfo = initResult;
        this.connected = true;
        return true;
      } catch (initError) {
        console.error('[MCP] Initialize failed:', initError instanceof Error ? initError.message : initError);
      }

      try {
        console.log('[MCP] Skipping initialize, trying tools/list directly...');
        const toolsResult = await this.sendRequest('tools/list');

        if (toolsResult && Array.isArray(toolsResult.tools)) {
          console.log(`[MCP] Tools list successful, found ${toolsResult.tools.length} tools`);
          this.connected = true;
          return true;
        }
      } catch (toolsError) {
        console.error('[MCP] Tools list failed:', toolsError instanceof Error ? toolsError.message : toolsError);
      }

      console.error('[MCP] All connection strategies failed');
      this.connected = false;
      return false;
    } catch (error) {
      console.error('[MCP] Connection failed:', error instanceof Error ? error.message : error);
      this.connected = false;
      return false;
    }
  }

  async listTools(): Promise<any[]> {
    try {
      console.log('[MCP] Listing available tools...');

      if (!this.connected) {
        const connected = await this.ping();
        if (!connected) {
          console.warn('[MCP] Not connected, cannot list tools');
          return [];
        }
      }

      const result = await this.sendRequest('tools/list', {});

      if (result && Array.isArray(result.tools)) {
        console.log(`[MCP] Found ${result.tools.length} tools:`, result.tools.map((t: any) => t.name));
        return result.tools;
      }

      console.warn('[MCP] Unexpected tools list response format:', result);
      return [];
    } catch (error) {
      console.error('[MCP] Error listing tools:', error instanceof Error ? error.message : error);

      try {
        console.log('[MCP] Retrying tools/list without params...');
        const result = await this.sendRequestWithoutParams('tools/list');

        if (result && Array.isArray(result.tools)) {
          console.log(`[MCP] Found ${result.tools.length} tools (no params):`, result.tools.map((t: any) => t.name));
          return result.tools;
        }
      } catch (retryError) {
        console.error('[MCP] Retry also failed:', retryError instanceof Error ? retryError.message : retryError);
      }

      return [];
    }
  }

  private async sendRequestWithoutParams(method: string): Promise<any> {
    const requestId = ++this.requestId;

    const requestBody = {
      jsonrpc: '2.0',
      id: requestId,
      method
    };

    console.log(`[MCP Request ${requestId}] ${method} (no params field)`);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream'
    };

    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    });

    console.log(`[MCP Response ${requestId}] Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      throw new Error(`MCP request failed (${response.status}): ${errorText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      return await this.parseSSEResponse(response);
    }

    const data = await response.json() as {
      error?: { message: string; code: number };
      result?: any;
    };

    if (data.error) {
      throw new Error(`MCP Error (code ${data.error.code}): ${data.error.message}`);
    }

    return data.result;
  }

  async callTool(toolName: string, args: Record<string, any> = {}): Promise<any> {
    try {
      if (!this.connected) {
        console.log('[MCP] Not connected, attempting to connect...');
        const connected = await this.ping();
        if (!connected) {
          throw new Error('Cannot call tool: MCP server not connected');
        }
      }

      console.log(`[MCP] Calling tool: ${toolName}`);

      const params: any = {
        name: toolName
      };

      if (args && Object.keys(args).length > 0) {
        params.arguments = args;
      }

      const result = await this.sendRequest('tools/call', params);

      console.log(`[MCP] Tool ${toolName} executed successfully`);
      return result;
    } catch (error) {
      console.error(`[MCP] Tool call failed for ${toolName}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async getFile(fileKey: string): Promise<any> {
    try {
      console.log(`[MCP] Getting Figma file: ${fileKey}`);

      const tools = await this.listTools();
      const getFileTool = tools.find((t: any) =>
        t.name && (
          t.name.toLowerCase().includes('get') &&
          t.name.toLowerCase().includes('file')
        )
      );

      if (!getFileTool) {
        throw new Error('No file retrieval tool found in Figma MCP server');
      }

      console.log(`[MCP] Using tool: ${getFileTool.name}`);

      return await this.callTool(getFileTool.name, {
        file_key: fileKey,
        ...(this.accessToken && { access_token: this.accessToken })
      });
    } catch (error) {
      console.error('[MCP] Get file failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async processPrompt(fileKey: string, prompt: string): Promise<any> {
    try {
      console.log(`[MCP] Processing prompt for file ${fileKey}`);
      console.log(`[MCP] Prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

      const tools = await this.listTools();
      console.log('[MCP] Available tools:', tools.map((t: any) => t.name));

      const designTool = tools.find((t: any) =>
        t.name && (
          t.name.toLowerCase().includes('create') ||
          t.name.toLowerCase().includes('modify') ||
          t.name.toLowerCase().includes('design') ||
          t.name.toLowerCase().includes('element')
        )
      );

      if (designTool) {
        console.log(`[MCP] Using design tool: ${designTool.name}`);
        return await this.callTool(designTool.name, {
          file_key: fileKey,
          prompt,
          ...(this.accessToken && { access_token: this.accessToken })
        });
      }

      console.warn('[MCP] No specific design tool found, listing all available tools');
      console.log('[MCP] Available tools:', JSON.stringify(tools, null, 2));

      throw new Error('No suitable design tool found in Figma MCP server. Available tools: ' +
        tools.map((t: any) => t.name).join(', '));
    } catch (error) {
      console.error('[MCP] Process prompt failed:', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  async getFileInfo(fileKey: string, accessToken?: string): Promise<any> {
    const token = accessToken || this.accessToken;
    return this.getFile(fileKey);
  }

  isConnected(): boolean {
    return this.connected;
  }

  getServerInfo(): any {
    return this.serverInfo;
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
    console.log('[MCP] Access token updated');
  }

  async shutdown(): Promise<void> {
    if (this.connected) {
      try {
        console.log('[MCP] Sending shutdown request...');
        await this.sendRequest('shutdown');
      } catch (error) {
        console.warn('[MCP] Shutdown request failed:', error instanceof Error ? error.message : error);
      } finally {
        this.connected = false;
        this.serverInfo = undefined;
        this.emit('disconnected');
        console.log('[MCP] Disconnected');
      }
    }
  }

  async restart(): Promise<boolean> {
    console.log('[MCP] Restarting connection...');
    await this.shutdown();
    return this.ping();
  }
}