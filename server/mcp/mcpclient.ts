import { gemini } from '@/mcp/gemini';
import { Client } from '@modelcontextprotocol/sdk/client/index';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse';

const LOG = "[MCP-CLIENT]";

function logError(context: string, error: unknown): void {
  console.error(`\n${"=".repeat(60)}`);
  console.error(`${LOG} ❌ ERROR in ${context}`);
  console.error(`${"=".repeat(60)}`);

  if (error instanceof Error) {
    console.error(`Message: ${error.message}`);
    console.error(`Name: ${error.name}`);
    if (error.stack) {
      console.error(`Stack:\n${error.stack}`);
    }
    // Log any additional properties on the error
    const errorObj = error as any;
    if (errorObj.code) console.error(`Code: ${errorObj.code}`);
    if (errorObj.data) console.error(`Data: ${JSON.stringify(errorObj.data, null, 2)}`);
    if (errorObj.cause) console.error(`Cause: ${errorObj.cause}`);
  } else {
    console.error(`Raw error:`, error);
  }
  console.error(`${"=".repeat(60)}\n`);
}

export class MCPClient {
  private mcpClient: Client | null = null;
  private transport: SSEClientTransport | null = null;
  private serverUrl: string;
  private llmModel: typeof gemini;
  private isConnected = false;
  private platform: string = "";
  private availableTools: any[] = [];

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
    this.llmModel = gemini;
    console.log(`${LOG} Created new client for: ${serverUrl}`);
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.mcpClient) {
      console.log(`${LOG} Already connected, reusing connection`);
      return;
    }

    console.log(`${LOG} Connecting to: ${this.serverUrl}`);

    try {
      this.transport = new SSEClientTransport(new URL(this.serverUrl));
      this.mcpClient = new Client({
        name: "superdesign-mcp-client",
        version: "1.0.0"
      }, {
        capabilities: {}
      });

      console.log(`${LOG} Establishing SSE connection...`);
      await this.mcpClient.connect(this.transport);
      this.isConnected = true;
      console.log(`${LOG} ✓ Connected to SuperDesign MCP Server`);
    } catch (error) {
      logError("connect() - Connecting to SuperDesign MCP Server", error);
      throw error;
    }
  }

  async setPlatform(platform: string, accessToken?: string): Promise<void> {
    if (!this.mcpClient) {
      throw new Error("MCP Client not connected. Call connect() first.");
    }

    console.log(`${LOG} Setting platform: ${platform}`);
    this.platform = platform;

    try {
      console.log(`${LOG} Calling tool: get_platform_tools`);
      console.log(`${LOG}    Platform: ${platform}`);
      console.log(`${LOG}    Has accessToken: ${!!accessToken}`);

      const result = await this.mcpClient.callTool({
        name: "get_platform_tools",
        arguments: { platform, accessToken }
      });

      console.log(`${LOG} get_platform_tools response received`);
      console.log(`${LOG}    Response type: ${typeof result}`);
      console.log(`${LOG}    Response: ${JSON.stringify(result).substring(0, 200)}...`);

      const content = (result as any).content?.[0];
      if (content?.type === "text") {
        const parsed = JSON.parse(content.text);
        this.availableTools = parsed.tools || [];
        console.log(`${LOG} ✓ Loaded ${this.availableTools.length} tools from ${platform}:`);
        this.availableTools.forEach((t: any) => {
          console.log(`${LOG}    - ${t.name}`);
        });
      } else {
        console.warn(`${LOG} ⚠️ Unexpected response format`);
        console.warn(`${LOG}    Content: ${JSON.stringify(content)}`);
        this.availableTools = [];
      }
    } catch (error) {
      logError("setPlatform() - Calling get_platform_tools on SuperDesign MCP Server", error);
      throw error;
    }
  }

  async generatePlan(
    userPrompt: string,
    fileId: string
  ): Promise<Array<{ tool: string; params: Record<string, any> }>> {
    console.log(`${LOG} Generating plan with Gemini...`);
    console.log(`${LOG}    Prompt: "${userPrompt}"`);
    console.log(`${LOG}    File ID: ${fileId}`);
    console.log(`${LOG}    Available tools: ${this.availableTools.length}`);

    if (this.availableTools.length === 0) {
      console.error(`${LOG} ❌ NO TOOLS AVAILABLE FOR PLANNING!`);
      console.error(`${LOG}    This means get_platform_tools failed or returned empty`);
      return [];
    }

    const toolDescriptions = this.availableTools.map(
      (t: any) => `- ${t.name}: ${t.description || "No description"}`
    ).join("\n");

    console.log(`${LOG} Available tools for Gemini:`);
    console.log(toolDescriptions);

    const sysPrompt = `You are a design automation assistant.
Based on the user's request, generate a step-by-step plan using the available tools.
Available tools for ${this.platform}:
${toolDescriptions}

IMPORTANT: Respond ONLY with a valid JSON array of steps.
Each step must have "tool" (string) and "params" (object) keys.
Example response:
[
  {"tool": "get_design_context", "params": {"fileKey": "${fileId}"}},
  {"tool": "get_metadata", "params": {"fileKey": "${fileId}"}}
]

User's file ID: ${fileId}
User's request: ${userPrompt}`;

    try {
      console.log(`${LOG} Calling Gemini API (model: gemini-3-flash-preview)...`);
      const res = await gemini.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: sysPrompt }] }]
      });

      const modelRes = res.text;
      console.log(`${LOG} Gemini response received`);
      console.log(`${LOG}    Response length: ${modelRes?.length || 0} chars`);
      console.log(`${LOG}    Full response:\n${modelRes}`);

      const jsonMatch = modelRes?.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        try {
          const steps = JSON.parse(jsonMatch[0]);
          console.log(`${LOG} ✓ Parsed ${steps.length} steps:`);
          steps.forEach((s: any, i: number) => {
            console.log(`${LOG}    Step ${i + 1}: ${s.tool} - ${JSON.stringify(s.params)}`);
          });
          return steps;
        } catch (parseError) {
          logError("generatePlan() - Parsing JSON from Gemini response", parseError);
          console.error(`${LOG} Raw JSON that failed to parse: ${jsonMatch[0]}`);
          throw parseError;
        }
      }

      console.error(`${LOG} ❌ NO JSON ARRAY FOUND IN GEMINI RESPONSE`);
      console.error(`${LOG}    Full response was:\n${modelRes}`);
      return [];
    } catch (error) {
      logError("generatePlan() - Calling Gemini API", error);
      throw error;
    }
  }

  async executeStep(toolName: string, toolArgs: Record<string, any>, accessToken?: string): Promise<any> {
    if (!this.mcpClient) {
      throw new Error("MCP Client not connected. Call connect() first.");
    }

    console.log(`${LOG} Executing tool via SuperDesign MCP Server...`);
    console.log(`${LOG}    Tool: ${toolName}`);
    console.log(`${LOG}    Platform: ${this.platform}`);
    console.log(`${LOG}    Args: ${JSON.stringify(toolArgs)}`);
    console.log(`${LOG}    Has accessToken: ${!!accessToken}`);

    try {
      console.log(`${LOG} Calling execute_platform_tool on SuperDesign MCP Server...`);

      const res = await this.mcpClient.callTool({
        name: "execute_platform_tool",
        arguments: {
          platform: this.platform,
          toolName,
          toolArgs,
          accessToken
        }
      });

      console.log(`${LOG} execute_platform_tool response received`);
      console.log(`${LOG}    Response: ${JSON.stringify(res).substring(0, 300)}...`);

      const content = (res as any).content?.[0];
      if (content?.type === "text") {
        const result = JSON.parse(content.text);
        console.log(`${LOG} ✓ Tool executed successfully`);
        return result;
      }

      console.log(`${LOG} ✓ Tool executed (raw response)`);
      return res;
    } catch (error) {
      logError(`executeStep() - Executing tool "${toolName}" via SuperDesign MCP Server`, error);
      throw error;
    }
  }

  async processRequest(
    prompt: string,
    fileId: string,
    platform: string,
    accessToken?: string,
    onStepComplete?: (stepIndex: number, result: any) => void
  ): Promise<{ success: boolean; result: any[] }> {
    await this.connect();
    await this.setPlatform(platform, accessToken);

    const steps = await this.generatePlan(prompt, fileId);
    console.log(`${LOG} Generated ${steps.length} steps`);

    if (steps.length === 0) {
      return { success: false, result: [{ error: "No steps generated" }] };
    }

    const results: any[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (!step) continue;

      console.log(`${LOG} Executing step ${i + 1}/${steps.length}: ${step.tool}`);
      try {
        const res = await this.executeStep(
          step.tool,
          { ...step.params, fileKey: fileId, accessToken },
          accessToken
        );

        results.push({ stepIndex: i, status: "success", result: res });

        if (onStepComplete) {
          onStepComplete(i, res);
        }
      } catch (error) {
        logError(`processRequest() - Step ${i + 1} failed`, error);
        results.push({ stepIndex: i, status: "error", error });
        break;
      }
    }

    return {
      success: results.every(res => res.status === "success"),
      result: results
    };
  }

  getAvailableTools(): any[] {
    return this.availableTools;
  }

  getCurrentPlatform() {
    return this.platform;
  }

  isClientConnected(): boolean {
    return this.isConnected;
  }

  async checkGeminiHealth(): Promise<{ status: string; model: string; error?: string }> {
    try {
      await this.llmModel.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: "ping" }] }]
      });

      return {
        status: "connected",
        model: "gemini-3-flash-preview"
      };
    } catch (error) {
      return {
        status: "error",
        model: "gemini-3-flash-preview",
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected && this.mcpClient) {
      try {
        console.log(`${LOG} Disconnecting...`);
        await this.mcpClient.close();
      } catch (e) {
        // Ignore close errors
      }
      this.mcpClient = null;
      this.transport = null;
      this.isConnected = false;
      console.log(`${LOG} ✓ Disconnected`);
    }
  }
}