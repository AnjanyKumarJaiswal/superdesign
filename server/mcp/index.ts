import { UnifiedMCPServer } from "./mcp";
import { FigmaProvider } from "@/providers/figmaProvider";
import { FramerProvider } from "@/providers/framerProvider";
import { CanvaProvider } from "@/providers/canvaProvider";

export const mcp = new UnifiedMCPServer();
mcp.registerProvider("figma", new FigmaProvider());
mcp.registerProvider("framer", new FramerProvider());
mcp.registerProvider("canva", new CanvaProvider());


