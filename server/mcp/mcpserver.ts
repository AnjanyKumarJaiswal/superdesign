import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse";
import { FigmaProvider } from "@/mcp/providers/figmaProvider";
import { getPluginBridge, startPluginBridge, FigmaPluginBridge } from "@/mcp/pluginBridge";
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
let pluginBridge: FigmaPluginBridge | null = null;

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
            const figmaTools = await mcpClient.listTools();

            const writeTools = [
                { name: "plugin_create_rectangle", description: "Create a rectangle in Figma (requires plugin connection)" },
                { name: "plugin_create_ellipse", description: "Create an ellipse/circle in Figma (requires plugin connection)" },
                { name: "plugin_create_text", description: "Create a text node in Figma (requires plugin connection)" },
                { name: "plugin_create_frame", description: "Create a frame in Figma (requires plugin connection)" },
                { name: "plugin_create_button", description: "Create a button component in Figma (requires plugin connection)" },
                { name: "plugin_modify_node", description: "Modify an existing node in Figma (requires plugin connection)" },
                { name: "plugin_set_fill", description: "Set the fill color of a node (requires plugin connection)" },
                { name: "plugin_delete_node", description: "Delete a node from Figma (requires plugin connection)" },
                { name: "plugin_group_nodes", description: "Group multiple nodes together (requires plugin connection)" },
            ];

            const allTools = [...figmaTools, ...writeTools];

            console.log(`${LOG}    ✓ Got ${allTools.length} tools (${figmaTools.length} read + ${writeTools.length} write)`);
            allTools.forEach((t: any) => {
                console.log(`${LOG}       - ${t.name}`);
            });

            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({ platform, tools: allTools })
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

        if (toolName.startsWith("plugin_")) {
            return executePluginTool(toolName, toolArgs);
        }

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

        const bridge = getPluginBridge();
        const pluginConnected = bridge?.isPluginConnected?.() || false;

        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    status: "running",
                    server: "superDesign-MCP-Server",
                    version: "1.0.0",
                    connectedPlatforms,
                    pluginConnected,
                    availablePlatforms: ["figma", "framer", "canva"],
                    uptime: process.uptime()
                })
            }]
        };
    }
);

async function executePluginTool(toolName: string, args: Record<string, any>): Promise<any> {
    const bridge = getPluginBridge();

    if (!bridge.isPluginConnected()) {
        console.log(`${LOG} ⚠️  Plugin not connected - cannot execute write operation`);
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    success: false,
                    error: "Figma plugin is not connected. Please open Figma and run the SuperDesign plugin."
                })
            }],
            isError: true
        };
    }

    const commandType = toolName.replace("plugin_", "");
    console.log(`${LOG} 🔌 Executing via plugin: ${commandType}`);

    try {
        const result = await bridge.executeCommand(commandType, args);

        console.log(`${LOG} ✓ Plugin command executed`);
        console.log(`${LOG}    Result: ${JSON.stringify(result).substring(0, 200)}`);

        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({ success: result.success, result: result.data, error: result.error })
            }]
        };
    } catch (error) {
        logError(`executePluginTool(${toolName})`, error);
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({ success: false, error: errorMsg })
            }],
            isError: true
        };
    }
}

mcpServer.registerTool(
    "plugin_create_rectangle",
    {
        title: "Create Rectangle",
        description: "Creates a rectangle shape in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            color: z.string().optional(),
            name: z.string().optional(),
            cornerRadius: z.number().optional()
        }
    },
    async (params) => executePluginTool("plugin_create_rectangle", params)
);

mcpServer.registerTool(
    "plugin_create_ellipse",
    {
        title: "Create Ellipse",
        description: "Creates an ellipse/circle shape in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            color: z.string().optional(),
            name: z.string().optional()
        }
    },
    async (params) => executePluginTool("plugin_create_ellipse", params)
);

mcpServer.registerTool(
    "plugin_create_text",
    {
        title: "Create Text",
        description: "Creates a text node in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            x: z.number().optional(),
            y: z.number().optional(),
            text: z.string().optional(),
            fontSize: z.number().optional(),
            color: z.string().optional(),
            fontFamily: z.string().optional(),
            name: z.string().optional()
        }
    },
    async (params) => executePluginTool("plugin_create_text", params)
);

mcpServer.registerTool(
    "plugin_create_frame",
    {
        title: "Create Frame",
        description: "Creates a frame (container) in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            color: z.string().optional(),
            name: z.string().optional()
        }
    },
    async (params) => executePluginTool("plugin_create_frame", params)
);

mcpServer.registerTool(
    "plugin_create_button",
    {
        title: "Create Button",
        description: "Creates a complete button component with background and text in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            x: z.number().optional(),
            y: z.number().optional(),
            text: z.string().optional(),
            backgroundColor: z.string().optional(),
            textColor: z.string().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            cornerRadius: z.number().optional(),
            name: z.string().optional()
        }
    },
    async (params) => executePluginTool("plugin_create_button", params)
);

mcpServer.registerTool(
    "plugin_modify_node",
    {
        title: "Modify Node",
        description: "Modifies an existing node's properties in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            nodeId: z.string(),
            x: z.number().optional(),
            y: z.number().optional(),
            width: z.number().optional(),
            height: z.number().optional(),
            rotation: z.number().optional(),
            opacity: z.number().optional(),
            visible: z.boolean().optional(),
            name: z.string().optional()
        }
    },
    async (params) => executePluginTool("plugin_modify_node", params)
);

mcpServer.registerTool(
    "plugin_set_fill",
    {
        title: "Set Fill Color",
        description: "Sets the fill color of a node in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            nodeId: z.string(),
            color: z.string(),
            opacity: z.number().optional()
        }
    },
    async (params) => executePluginTool("plugin_set_fill", params)
);

mcpServer.registerTool(
    "plugin_delete_node",
    {
        title: "Delete Node",
        description: "Deletes a node from Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            nodeId: z.string()
        }
    },
    async (params) => executePluginTool("plugin_delete_node", params)
);

mcpServer.registerTool(
    "plugin_group_nodes",
    {
        title: "Group Nodes",
        description: "Groups multiple nodes together in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            nodeIds: z.array(z.string()),
            name: z.string().optional()
        }
    },
    async (params) => executePluginTool("plugin_group_nodes", params)
);

mcpServer.registerTool(
    "plugin_clone_node",
    {
        title: "Clone Node",
        description: "Clones/duplicates a node in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            nodeId: z.string(),
            offsetX: z.number().optional(),
            offsetY: z.number().optional()
        }
    },
    async (params) => executePluginTool("plugin_clone_node", params)
);

mcpServer.registerTool(
    "plugin_set_corner_radius",
    {
        title: "Set Corner Radius",
        description: "Sets the corner radius of a rectangle or frame in Figma. Requires the SuperDesign Figma plugin to be running.",
        inputSchema: {
            nodeId: z.string(),
            radius: z.number()
        }
    },
    async (params) => executePluginTool("plugin_set_corner_radius", params)
);

mcpServer.registerTool(
    "get_plugin_status",
    {
        title: "Get Plugin Status",
        description: "Checks if the Figma plugin is connected and ready for write operations"
    },
    async () => {
        const bridge = getPluginBridge();
        const isConnected = bridge?.isPluginConnected?.() || false;

        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    pluginConnected: isConnected,
                    message: isConnected
                        ? "Figma plugin is connected and ready for design operations"
                        : "Figma plugin is not connected. Open Figma and run the SuperDesign plugin."
                })
            }]
        };
    }
);

let httpServer: any = null;
const activeTransports: Map<string, SSEServerTransport> = new Map();

export async function startMCPServer(port: number = 3846): Promise<void> {
    const app = express();

    try {
        pluginBridge = await startPluginBridge();

        pluginBridge.on('plugin-connected', () => {
            console.log(`${LOG} 🎉 Figma plugin connected!`);
        });

        pluginBridge.on('plugin-disconnected', () => {
            console.log(`${LOG} ⚠️ Figma plugin disconnected`);
        });
    } catch (error) {
        console.error(`${LOG} ⚠️ Failed to start plugin bridge:`, error);
        console.log(`${LOG}    Write operations will not be available`);
    }

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
        const bridge = getPluginBridge();
        res.json({
            status: "ok",
            server: "superDesign-MCP-Server",
            version: "1.0.0",
            connectedClients: activeTransports.size,
            pluginConnected: bridge?.isPluginConnected?.() || false,
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
            console.log(`  🔌 Plugin WS:  ws://localhost:3847`);
            console.log(`${"=".repeat(60)}`);

            const figmaMCPUrl = process.env.FIGMA_MCP_URL || "http://127.0.0.1:3845/sse";

            try {
                const figmaProvider = new FigmaProvider({
                    mcpServerUrl: figmaMCPUrl
                });
                await figmaProvider.initialize();

                if (figmaProvider.isReady()) {
                    console.log(`  ✅ Figma MCP:   CONNECTED`);
                    platformClients.figma = figmaProvider;
                } else {
                    console.log(`  ⚠️  Figma MCP:   Not fully connected`);
                    platformClients.figma = figmaProvider;
                }
            } catch (error) {
                console.log(`  ❌ Figma MCP:   Not running (port 3845)`);
            }

            const bridge = getPluginBridge();
            const pluginConnected = bridge?.isPluginConnected?.() || false;
            console.log(`  ${pluginConnected ? '✅' : '⏳'} Figma Plugin: ${pluginConnected ? 'CONNECTED' : 'Waiting for connection...'}`);

            console.log(`${"=".repeat(60)}\n`);
            resolve();
        });
    });
}

export async function shutdownMCPServer(): Promise<void> {
    console.log(`${LOG} Shutting down...`);

    if (pluginBridge) {
        await pluginBridge.shutdown();
        pluginBridge = null;
    }

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
