import { UnifiedMCPServer } from "./mcpserver";
import { FigmaProvider } from "../providers/figmaProvider";
import { FramerProvider } from "../providers/framerProvider";

export const mcp = new UnifiedMCPServer();

const figmaProvider = new FigmaProvider({
  mcpServerUrl: process.env.FIGMA_MCP_URL,
  hostUrl: process.env.CLIENT_URL || 'http://localhost:5173'
});

const framerProvider = new FramerProvider();

(async () => {
  try {
    await mcp.registerProvider("figma", figmaProvider);
    console.log("Figma provider registered");
  } catch (error) {
    console.error("Failed to register Figma provider:", error);
  }

  try {
    await mcp.registerProvider("framer", framerProvider);
    console.log("Framer provider registered");
  } catch (error) {
    console.error("Failed to register Framer provider:", error);
  }
})().catch(err => {
  console.error("Error during provider registration:", err);
});


process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("exit", () => {
  console.log("[MCP] Process exiting...");
});
