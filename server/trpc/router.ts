import { router } from ".";
import { jobManaging } from "@/trpc/routers/job";
import { OAuthRouter } from "@/trpc/routers/auth";
import { healthRouter } from "@/trpc/routers/health";
import { providerRouters } from "@/trpc/routers/provider";
import { mcpTasks, mcpGenerateDesign } from "@/trpc/routers/mcp";
import { figmaEmbed } from "@/trpc/routers/figma";

export const appRouter = router({

  //status about server health
  health: healthRouter,

  //getting all design framework providers
  getProviders: providerRouters,

  //auth
  auth: OAuthRouter,

  //responsible for design in the iframe
  generateDesign: mcpGenerateDesign,

  // list of all MCP tasks
  executeMCPTask: mcpTasks,

  //getting the embed url link
  getFigmaEmbed: figmaEmbed,

  // getting the current job status
  getJobStatus: jobManaging,


  //this is for testing the connection between the MCPs

  // testMCPConnection: publicProcedure
  //   .input(z.object({
  //     provider: z.enum(["figma", "framer", "canva"]).optional()
  //   }))
  //   .query(({ input }) => {
  //     const provider = input.provider;

  //     if (provider) {
  //       const providerInstance = mcp.getProvider(provider);
  //       return {
  //         provider,
  //         available: !!providerInstance,
  //         connected: providerInstance ? (providerInstance as any).isConnected?.() : false
  //       };
  //     }

  //     const providers = mcp.getProviders();
  //     const status = providers.map(p => {
  //       const providerInstance = mcp.getProvider(p);
  //       return {
  //         name: p,
  //         available: !!providerInstance,
  //         connected: providerInstance ? (providerInstance as any).isConnected?.() : false
  //       };
  //     });

  //     return {
  //       providers: status,
  //       totalAvailable: status.filter(p => p.available).length,
  //       totalConnected: status.filter(p => p.connected).length
  //     };
  //   }),

}) satisfies ReturnType<typeof router>;

export type AppRouter = typeof appRouter;