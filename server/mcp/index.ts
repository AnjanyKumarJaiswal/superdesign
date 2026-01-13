import { UnifiedMCPServer } from "@/mcp/mcpserver";
import { FigmaProvider } from "@/mcp/providers/figmaProvider";
import { FramerProvider } from "@/mcp/providers/framerProvider";
import { colors } from "@/types";

export const mcp = new UnifiedMCPServer();

const figmaProvider = new FigmaProvider({
  mcpServerUrl: process.env.FIGMA_MCP_URL,
  hostUrl: process.env.CLIENT_URL
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

const shutdown = (signal: string) => {
  console.log(
    `\n${colors.yellow}${signal}  received, shutting down gracefully...${colors.reset}`,
  );
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("exit", () => {
  console.log("[MCP] Process exiting...");
});
