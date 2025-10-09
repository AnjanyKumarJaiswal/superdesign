import { UnifiedMCPServer } from "./mcpserver";
import { FigmaProvider } from "../providers/figmaProvider";
import { FramerProvider } from "../providers/framerProvider";

// Create MCP server instance
export const mcp = new UnifiedMCPServer();

// Create provider instances
const figmaProvider = new FigmaProvider();
const framerProvider = new FramerProvider();

// Register providers
mcp.registerProvider("figma", figmaProvider);
mcp.registerProvider("framer", framerProvider);

// Initialize MCP server
mcp.initialize().catch((error) => {
  console.error("Failed to initialize MCP server:", error);
});

// Graceful shutdown handler
const shutdown = async () => {
  console.log("\n[MCP] Shutting down providers...");

  try {
    // Shutdown Figma provider MCP client
    if (typeof figmaProvider.shutdown === "function") {
      await figmaProvider.shutdown();
    }

    // Shutdown Framer provider if it has shutdown method
    if (typeof framerProvider.shutdown === "function") {
      await (framerProvider as any).shutdown();
    }

    // Shutdown MCP server
    await mcp.shutdown();

    console.log("[MCP] Shutdown complete");
    process.exit(0);
  } catch (error) {
    console.error("[MCP] Error during shutdown:", error);
    process.exit(1);
  }
};

// Register shutdown handlers
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("exit", () => {
  console.log("[MCP] Process exiting...");
});
