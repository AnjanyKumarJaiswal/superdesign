import { UnifiedMCPServer } from "./mcpserver";
import { FigmaProvider } from "@/providers/figmaProvider";
import { FramerProvider } from "@/providers/framerProvider";

export const mcp = new UnifiedMCPServer();
mcp.registerProvider("figma", new FigmaProvider());
mcp.registerProvider("framer", new FramerProvider());


