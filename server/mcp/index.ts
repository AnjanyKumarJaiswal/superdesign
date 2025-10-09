import { UnifiedMCPServer } from "./mcp";
import { FigmaProvider } from "@/server/providers/figmaProvider";
import { FramerProvider } from "@/server/providers/framerProvider";
import { CanvaProvider } from "@/server/providers/canvaProvider";

export const mcp = new UnifiedMCPServer();
mcp.registerProvider("figma", new FigmaProvider());
mcp.registerProvider("framer", new FramerProvider());
mcp.registerProvider("canva", new CanvaProvider());


