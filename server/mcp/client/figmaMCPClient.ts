import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { Client } from "@modelcontextprotocol/sdk/client/index";

export class FigmaMCPClient {
    private mcpClient: Client;
    private accessToken?: string;
    private connected = false;
    private transport: SSEClientTransport;
    private isConnecting = false;

    constructor(figmaMCPServerURL: string, accessToken: any) {
        this.transport = new SSEClientTransport(new URL(figmaMCPServerURL));

        this.mcpClient = new Client({
            name: "figma-mcp-client",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        // this.mcpClient.connect(this.transport);

        this.accessToken = accessToken || process.env.FIGMA_ACCESS_TOKEN;
        console.log("[FIGMA-MCP-CLIENT] Initialized Figma MCP Client with URL:", figmaMCPServerURL);
    }

    private async ensureConnected(): Promise<void> {
        if (this.connected) {
            return;
        }

        // Prevent multiple simultaneous connection attempts
        if (this.isConnecting) {
            // Wait a bit and check again
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.ensureConnected();
        }

        try {
            this.isConnecting = true;
            await this.mcpClient.connect(this.transport);
            console.log("[FIGMA-MCP-CLIENT] Connection established");
            this.connected = true;
        } catch (error) {
            console.error("[FIGMA-MCP-CLIENT] Connection failed:", error);
            this.connected = false;
            throw error;
        } finally {
            this.isConnecting = false;
        }
    }

    async ping(): Promise<boolean> {
        try {
            console.log("[FIGMA-MCP-CLIENT] Attempting to connect to Figma MCP server...");

            await this.ensureConnected();

            const { tools } = await this.mcpClient.listTools();

            if (tools) {
                console.log(`[FIGMA-MCP-CLIENT] Connected successfully, found ${tools.length} tools`);
                this.connected = true;
                return true;
            }
            console.warn("[FIGMA-MCP-CLIENT] Connection check failed - no tools found");
            this.connected = false;
            return false;
        } catch (error) {
            console.error(
                "[FIGMA-MCP-CLIENT] Connection failed:",
                error instanceof Error ? error.message : error
            );
            this.connected = false;
            return false;
        }
    }

    async findTools(keyowrds: string[], args: any): Promise<any> {
        try {
            const { tools } = await this.mcpClient.listTools();
            const tool = tools.find(tool => {
                return keyowrds.every(keyword => tool?.name.toLowerCase().includes(keyword));
            })

            if (!tool) {
                throw new Error(`Could not find tool matching: ${keyowrds.join(',')}`);
            }

            return await this.mcpClient.callTool({
                name: tool.name,
                arguments: args
            })
        } catch (error) {
            console.error("[FIGMA-MCP-CLIENT] Error finding the tools from Figma")
            throw error;
        }
    }

    async listTools(): Promise<any[]> {
        try {
            console.log("[FIGMA-MCP-CLIENT] Listing available tools...");
            if (!this.connected) {
                const isConnected = await this.ping();
                if (!isConnected) {
                    console.warn("[FIGMA-MCP-CLIENT] Not connected, cannot list tools");
                    return [];
                }
            }
            const { tools } = await this.mcpClient.listTools();

            if (tools) {
                console.log(`[FIGMA-MCP-CLIENT] Found ${tools.length} tools:`, tools.map((tool: any) => tool.name));
                return tools;
            }
            console.warn("[FIGMA-MCP-CLIENT] Unexpected tools list response format");
            return [];
        } catch (error) {
            console.error(
                "[FIGMA-MCP-CLIENT] Error listing tools:",
                error instanceof Error ? error.message : error
            );
            throw error;
        }
    }

    async callTools(toolName: string, args: Record<string, any> = {}): Promise<any> {
        try {
            if (!this.connected) {
                console.log("[FIGMA-MCP-CLIENT] Not connected, attempting to connect...");
                const isConnected = await this.ping();
                if (!isConnected) {
                    throw new Error("Cannot call tool: MCP server not connected");
                }
            }
            console.log(`[FIGMA-MCP-CLIENT] Calling tool: ${toolName}`);

            const res = await this.mcpClient.callTool({
                name: toolName,
                arguments: args
            });

            console.log(`[FIGMA-MCP-CLIENT] Tool ${toolName} executed successfully`);
            return res;
        } catch (error) {
            console.error(
                `[FIGMA-MCP-CLIENT] Tool call failed for ${toolName}:`,
                error instanceof Error ? error.message : error
            );
            throw error;
        }
    }

    async processPrompt(fileKey: string, prompt: string): Promise<any> {
        try {
            console.log(`[FIGMA-MCP-CLIENT] Processing prompt for file ${fileKey}`);
            console.log(`[FIGMA-MCP-CLIENT] Prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"`);

            const tools = await this.listTools();
            console.log("[FIGMA-MCP-CLIENT] Available tools:", tools.map((t: any) => t.name));

            const designTool = tools.find((tool: any) => tool.name.toLowerCase());

            if (designTool) {
                console.log(`[FIGMA-MCP-CLIENT] Using design tool: ${designTool.name}`);
                return await this.callTools(designTool.name, {
                    fileKey: fileKey,
                    prompt,
                    ...(this.accessToken && { accessToken: this.accessToken })
                });
            }
            console.warn("[FIGMA-MCP-CLIENT] No specific design tool found");
            throw new Error('No suitable design tool found. Available tools:' + tools.map((tool: any) => tool.name).join(', '));
        } catch (error) {
            console.error(
                "[FIGMA-MCP-CLIENT] Process prompt failed:",
                error instanceof Error ? error.message : error
            );
            throw error;
        }
    }

    isConnected(): boolean {
        return this.connected;
    }

    setAccessToken(token: string): void {
        this.accessToken = token;
        console.log("[FIGMA-MCP-CLIENT] Access token updated");
    }

    async shutdown(): Promise<any> {
        if (this.connected) {
            await this.mcpClient.close();
            console.log("[FIGMA-MCP-CLIENT] Disconnected");
        }
    }
}