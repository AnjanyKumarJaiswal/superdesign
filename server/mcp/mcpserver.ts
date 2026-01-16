import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import { FigmaProvider } from "@/mcp/providers/figmaProvider";
import express from "express";

const LOG = "[MCP-SERVER]";

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
        const errorObj = error as any;
        if (errorObj.code) console.error(`Code: ${errorObj.code}`);
        if (errorObj.data) console.error(`Data: ${JSON.stringify(errorObj.data, null, 2)}`);
    } else {
        console.error(`Raw error:`, error);
    }
    console.error(`${"=".repeat(60)}\n`);
}

export const mcpServer = new McpServer({
    name: "superDesign-MCP-Server",
    version: "1.0.0"
});

const platformClients: Record<string, FigmaProvider> = {};

async function initializePlatformClient(platform: string, accessToken?: string): Promise<FigmaProvider | null> {
    console.log(`${LOG} initializePlatformClient called`);
    console.log(`${LOG}    Platform: ${platform}`);
    console.log(`${LOG}    Has accessToken: ${!!accessToken}`);

    if (platform === "figma") {
        try {
            if (!platformClients.figma) {
                const figmaMCPServerURL = process.env.FIGMA_MCP_URL || "http://127.0.0.1:3845/sse";
                console.log(`${LOG}    Creating new FigmaProvider with URL: ${figmaMCPServerURL}`);

                platformClients.figma = new FigmaProvider({
                    mcpServerUrl: figmaMCPServerURL,
                    accessToken: accessToken
                });
            }

            if (!platformClients.figma.isReady()) {
                console.log(`${LOG}    Initializing FigmaProvider...`);
                await platformClients.figma.initialize();
                console.log(`${LOG}    FigmaProvider ready: ${platformClients.figma.isReady()}`);
            } else {
                console.log(`${LOG}    FigmaProvider already ready`);
            }

            return platformClients.figma;
        } catch (error) {
            logError(`initializePlatformClient(${platform})`, error);
            throw error;
        }
    }

    console.log(`${LOG}    Platform "${platform}" not supported`);
    return null;
}

mcpServer.registerTool(
    "get_platform_tools",
    {
        title: "Get Platform Tools",
        description: "Fetches all available tools from the specified design platform's MCP server",
        inputSchema: {
            platform: z.string(),
            accessToken: z.string().optional()
        }
    },
    async ({ platform, accessToken }) => {
        console.log(`\n${LOG} ────────────────────────────────────────`);
        console.log(`${LOG} TOOL CALL: get_platform_tools`);
        console.log(`${LOG}    Platform: ${platform}`);
        console.log(`${LOG} ────────────────────────────────────────`);

        try {
            const client = await initializePlatformClient(platform, accessToken);

            if (!client) {
                console.error(`${LOG}    Platform ${platform} not supported`);
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ error: `Platform ${platform} not supported` })
                    }]
                };
            }

            console.log(`${LOG}    Getting tools from FigmaMCPClient...`);
            const mcpClient = client.getMCPClient();
            const tools = await mcpClient.listTools();

            console.log(`${LOG}    ✓ Got ${tools.length} tools from ${platform}`);
            tools.forEach((t: any) => {
                console.log(`${LOG}       - ${t.name}`);
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ platform, tools })
                }]
            };
        } catch (error) {
            logError(`get_platform_tools(${platform})`, error);
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ error: errorMsg, platform })
                }]
            };
        }
    }
);

mcpServer.registerTool(
    "execute_platform_tool",
    {
        title: "Execute Platform Tools",
        description: "Executes a specific tool on the design platform",
        inputSchema: {
            platform: z.string(),
            toolName: z.string(),
            toolArgs: z.record(z.any()),
            accessToken: z.string(),
        },
    },
    async ({ platform, toolName, toolArgs, accessToken }) => {
        console.log(`\n${LOG} ────────────────────────────────────────`);
        console.log(`${LOG} TOOL CALL: execute_platform_tool`);
        console.log(`${LOG}    Platform: ${platform}`);
        console.log(`${LOG}    Tool: ${toolName}`);
        console.log(`${LOG}    Args: ${JSON.stringify(toolArgs).substring(0, 100)}...`);
        console.log(`${LOG} ────────────────────────────────────────`);

        try {
            const client = await initializePlatformClient(platform, accessToken);

            if (!client) {
                console.error(`${LOG}    Platform ${platform} not supported`);
                return {
                    content: [{
                        type: "text" as const,
                        text: JSON.stringify({ error: `Platform ${platform} not supported` })
                    }]
                };
            }

            console.log(`${LOG}    Calling tool "${toolName}" on Figma MCP...`);
            const mcpClient = client.getMCPClient();
            const res = await mcpClient.callTool(toolName, toolArgs);

            console.log(`${LOG}    ✓ Tool "${toolName}" executed successfully`);
            console.log(`${LOG}    Response: ${JSON.stringify(res).substring(0, 200)}...`);

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ success: true, result: res })
                }]
            };
        } catch (error) {
            logError(`execute_platform_tool(${toolName})`, error);
            const errorMsg = error instanceof Error ? error.message : "Unknown error";
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ success: false, error: errorMsg })
                }]
            };
        }
    }
);

mcpServer.registerTool(
    "get_server_status",
    {
        title: "Getting Server status",
        description: "Returns the current status of the SuperDesign MCP Server"
    },
    async () => {
        const connectedPlatforms = Object.keys(platformClients).filter(
            platform => platformClients[platform]?.isReady?.()
        );
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    status: "running",
                    server: "superDesign-MCP-Server",
                    version: "1.0.0",
                    connectedPlatforms,
                    availablePlatforms: ["figma", "framer", "canva"],
                    uptime: process.uptime()
                })
            }]
        };
    }
);

let httpServer: any = null;
// Map sessionId to transport for message routing
const activeTransports: Map<string, SSEServerTransport> = new Map();

export async function startMCPServer(port: number = 3846): Promise<void> {
    const app = express();

    app.get("/sse", async (req, res) => {
        console.log(`${LOG} New SSE connection request`);

        try {
            const transport = new SSEServerTransport("/messages", res);
            console.log(`${LOG} SSE transport created, starting connection...`);

            await mcpServer.connect(transport);

            const sessionId = (transport as any).sessionId || `session_${Date.now()}`;
            activeTransports.set(sessionId, transport);
            console.log(`${LOG} SSE session started: ${sessionId}`);
            console.log(`${LOG} MCP server connected to transport: ${sessionId}`);

            res.on("close", () => {
                console.log(`${LOG} SSE connection closed: ${sessionId}`);
                activeTransports.delete(sessionId);
            });

        } catch (error) {
            logError("SSE connection setup", error);
            if (!res.headersSent) {
                res.status(500).send("SSE connection failed");
            }
        }
    });

    app.post("/messages", async (req, res) => {
        const sessionId = req.query.sessionId as string;

        if (!sessionId) {
            console.error(`${LOG} /messages: No sessionId provided`);
            res.status(400).json({ error: "Missing sessionId" });
            return;
        }

        const transport = activeTransports.get(sessionId);

        if (!transport) {
            console.error(`${LOG} /messages: No transport found for session: ${sessionId}`);
            res.status(404).json({ error: "Session not found" });
            return;
        }

        try {
            await transport.handlePostMessage(req, res);
        } catch (error) {
            logError("/messages handling", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Failed to process message" });
            }
        }
    });

    app.get("/health", (req, res) => {
        res.json({
            status: "ok",
            server: "superDesign-MCP-Server",
            version: "1.0.0",
            connectedClients: activeTransports.size,
            activeSessions: Array.from(activeTransports.keys()),
            timestamp: new Date().toISOString()
        });
    });

    return new Promise(async (resolve) => {
        httpServer = app.listen(port, async () => {
            console.log(`\n${"=".repeat(60)}`);
            console.log(`  SuperDesign MCP Server`);
            console.log(`${"=".repeat(60)}`);
            console.log(`  🌐 Server:     http://localhost:${port}`);
            console.log(`  📡 SSE:        http://localhost:${port}/sse`);
            console.log(`  💚 Health:     http://localhost:${port}/health`);
            console.log(`${"=".repeat(60)}\n`);

            console.log(`${LOG} Testing Figma MCP connection...`);
            const figmaMCPUrl = process.env.FIGMA_MCP_URL || "http://127.0.0.1:3845/sse";
            console.log(`${LOG} Figma MCP URL: ${figmaMCPUrl}`);

            try {
                const figmaProvider = new FigmaProvider({
                    mcpServerUrl: figmaMCPUrl
                });
                await figmaProvider.initialize();

                if (figmaProvider.isReady()) {
                    console.log(`${LOG} ✅ Figma MCP Server: CONNECTED`);
                    const mcpClient = figmaProvider.getMCPClient();
                    const tools = await mcpClient.listTools();
                    console.log(`${LOG}    Available tools: ${tools.length}`);
                    platformClients.figma = figmaProvider;
                } else {
                    console.log(`${LOG} ⚠️  Figma MCP Server: Initialized but not fully connected`);
                    platformClients.figma = figmaProvider;
                }
            } catch (error) {
                logError("Figma MCP connection test", error);
                console.log(`${LOG}    Make sure Figma MCP server is running on port 3845`);
            }
            console.log("");
            resolve();
        });
    });
}

export async function shutdownMCPServer(): Promise<void> {
    console.log(`${LOG} Shutting down...`);
    for (const [platform, client] of Object.entries(platformClients)) {
        if (client?.shutdown) {
            await client.shutdown();
            console.log(`${LOG} ${platform} client disconnected`);
        }
    }
    if (httpServer) {
        httpServer.close();
        console.log(`${LOG} HTTP server closed`);
    }
    console.log(`${LOG} Shutdown complete`);
}
