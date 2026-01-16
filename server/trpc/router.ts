import { router } from ".";
import { OAuthRouter } from "@/trpc/routers/auth";
import { healthRouter } from "@/trpc/routers/health";
import { providerRouters } from "@/trpc/routers/provider";
import { mcpTasks, mcpGenerateDesign } from "@/trpc/routers/mcp";
import { figmaEmbed } from "@/trpc/routers/figma";

export const appRouter = router({

  // Status about server health
  health: healthRouter,

  // Getting all design framework providers
  getProviders: providerRouters,

  // Auth
  auth: OAuthRouter,

  // Responsible for design generation
  generateDesign: mcpGenerateDesign,

  // List of all MCP tasks
  executeMCPTask: mcpTasks,

  // Getting the embed url link
  getFigmaEmbed: figmaEmbed,

}) satisfies ReturnType<typeof router>;

export type AppRouter = typeof appRouter;