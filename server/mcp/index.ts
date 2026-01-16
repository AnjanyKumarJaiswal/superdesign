import { startMCPServer, shutdownMCPServer, mcpServer } from "@/mcp/mcpServer";
import { MCPClient } from "@/mcp/mcpClient";
import { colors } from "@/types";
export { shutdownMCPServer }
// export const mcp = mcpServer();

const MCP_SERVER_PORT = parseInt(process.env.SUPERDESIGN_MCP_PORT || "3846", 10);

export async function initializeMCP(): Promise<void> {
  try {
    await startMCPServer(MCP_SERVER_PORT);
    console.log(`${colors.green}[MCP] SuperDesign MCP Server started on port ${MCP_SERVER_PORT}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}[MCP] Failed to start MCP Server:${colors.reset}`, error);
    throw error;
  }
}

export function createMCPClient(serverUrl?: string): MCPClient {
  const url = serverUrl || `http://localhost:${MCP_SERVER_PORT}/sse`;
  return new MCPClient(url);
}

const shutdown = async (signal: string) => {
  console.log(`\n${colors.yellow}${signal} received, shutting down gracefully...${colors.reset}`);
  try {
    await shutdownMCPServer();
    console.log(`${colors.green}[MCP] Server shutdown complete${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}[MCP] Error during shutdown:${colors.reset}`, error);
  }
  process.exit(0);
};

let healthCheckClient: MCPClient | null = null;

export async function getMCPHealthStatus(): Promise<{
  mcpServer: { status: string; port: number; url: string };
  mcpClient: { status: string; connected: boolean; error?: string };
  gemini: { status: string; model: string; error?: string };
  timestamp: string;
}> {
  const serverUrl = `http://localhost:${MCP_SERVER_PORT}/sse`;
  let serverStatus = "unknown";

  try {
    const response = await fetch(`http://localhost:${MCP_SERVER_PORT}/health`);
    serverStatus = response.ok ? "running" : "error";
  } catch {
    serverStatus = "not_running";
  }

  let clientStatus = "unknown";
  let clientConnected = false;
  let clientError: string | undefined;

  let geminiStatus: { status: string; model: string; error?: string } = {
    status: "not_checked",
    model: "gemini-3-flash-preview"
  };

  // Check Gemini independently (doesn't need MCP client)
  try {
    const { gemini } = await import("@/mcp/gemini");
    const response = await gemini.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: "respond with: ok" }] }]
    });

    geminiStatus = {
      status: "connected",
      model: "gemini-3-flash-preview"
    };
  } catch (error) {
    geminiStatus = {
      status: "error",
      model: "gemini-3-flash-preview",
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }

  // Check MCP Client connection
  try {
    if (!healthCheckClient) {
      healthCheckClient = new MCPClient(serverUrl);
    }

    // Don't actually connect for health check - just report if already connected
    clientConnected = healthCheckClient.isClientConnected();
    clientStatus = clientConnected ? "connected" : "not_connected";

  } catch (error) {
    clientStatus = "error";
    clientError = error instanceof Error ? error.message : "Unknown error";
  }

  return {
    mcpServer: {
      status: serverStatus,
      port: MCP_SERVER_PORT,
      url: serverUrl
    },
    mcpClient: {
      status: clientStatus,
      connected: clientConnected,
      error: clientError
    },
    gemini: geminiStatus,
    timestamp: new Date().toISOString()
  };
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("exit", () => {
  console.log("[MCP] Process exiting...");
});
