import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "./trpc";
import {
  createWorkflow,
  workflowEmitter,
  type WorkflowEvent,
} from "@/orchestrator/orchestrator";
import { mcp } from "@/mcp";
import { jobManager } from "@/jobs/jobManager";
import { oauthService, OAuthError } from "@/auth/oauthService";
import { generateToken, type UserPayload } from "@/auth/jwtService";

export const appRouter = router({
  health: publicProcedure.query(() => {
    const endpoints = {
      health: "Active - Returns all available endpoints and their status",
      getProviders: "Active - Returns all supported design platforms",
      auth: {
        figma: "Active - Authenticates with Figma and returns access token",
        framer: "Active - Authenticates with Framer and returns access token",
        canva: "Active - Authenticates with Canva and returns access token",
      },
      generateDesign:
        "Active - Starts design generation using the specified platform",
      executeMCPTask: "Active - Directly executes tasks on the MCP server",
      getJobStatus: "Active - Returns the status of a specific job",
      getFigmaEmbed: "Active - Returns embed URL for a Figma file",
    };

    const providers = mcp.getProviders();
    const mcpStatus = providers.length > 0 ? "connected" : "initializing";

    return {
      ok: true,
      timestamp: new Date().toISOString(),
      endpoints,
      mcp: {
        status: mcpStatus,
        providers
      }
    };
  }),

  getProviders: publicProcedure.query(() => {
    const providers = mcp.getProviders();

    return {
      providers,
      count: providers.length,
      available: providers.length > 0
    };
  }),

  auth: router({
    getAuthUrl: publicProcedure
      .input(
        z.object({
          platform: z.enum(["figma", "framer"]),
          state: z.string().optional(),
        }),
      )
      .query(({ input }) => {
        try {
          const authUrl = oauthService.getAuthorizationUrl(
            input.platform,
            input.state,
          );
          return {
            authUrl,
            platform: input.platform,
          };
        } catch (error) {
          if (error instanceof OAuthError) {
            throw new Error(`OAuth error: ${error.message}`);
          }
          throw error;
        }
      }),

    callback: publicProcedure
      .input(
        z.object({
          platform: z.enum(["figma", "framer"]),
          code: z.string(),
          state: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const tokenResponse = await oauthService.exchangeCodeForToken(
            input.platform,
            input.code,
          );

          const userId = `${input.platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

          const userPayload: UserPayload = {
            userId,
            platform: input.platform,
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken
          };

          const jwt = generateToken(userPayload);

          return {
            token: jwt,
            userId,
            platform: input.platform,
            expiresIn: tokenResponse.expiresIn,
          };
        } catch (error) {
          if (error instanceof OAuthError) {
            throw new Error(`${input.platform} OAuth error: ${error.message}`);
          }
          throw error;
        }
      }),

    figma: publicProcedure
      .input(
        z.object({
          code: z.string().optional(),
          state: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          if (!input.code) {
            const authUrl = oauthService.getAuthorizationUrl(
              "figma",
              input.state,
            );
            return {
              authUrl,
              accessToken: null,
              platform: "figma",
            };
          }

          const tokenResponse = await oauthService.exchangeCodeForToken(
            "figma",
            input.code,
          );

          return {
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
            expiresIn: tokenResponse.expiresIn,
            tokenType: tokenResponse.tokenType,
            platform: "figma",
            authUrl: null,
          };
        } catch (error) {
          if (error instanceof OAuthError) {
            throw new Error(`Figma OAuth error: ${error.message}`);
          }
          throw error;
        }
      }),

    framer: publicProcedure
      .input(
        z.object({
          code: z.string().optional(),
          state: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          if (!input.code) {
            const authUrl = oauthService.getAuthorizationUrl(
              "framer",
              input.state,
            );
            return {
              authUrl,
              accessToken: null,
              platform: "framer",
            };
          }

          const tokenResponse = await oauthService.exchangeCodeForToken(
            "framer",
            input.code,
          );

          return {
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
            expiresIn: tokenResponse.expiresIn,
            tokenType: tokenResponse.tokenType,
            platform: "framer",
            authUrl: null,
          };
        } catch (error) {
          if (error instanceof OAuthError) {
            throw new Error(`Framer OAuth error: ${error.message}`);
          }
          throw error;
        }
      }),

    refresh: publicProcedure
      .input(
        z.object({
          platform: z.enum(["figma", "framer"]),
          refreshToken: z.string(),
        }),
      )
      .mutation(async ({ input }) => {
        throw new Error('Token refresh is not implemented in simplified OAuth flow');
      }),

    checkProvider: publicProcedure
      .input(
        z.object({
          platform: z.enum(["figma", "framer"]),
        }),
      )
      .query(({ input }) => {
        return {
          platform: input.platform,
          configured: oauthService.isProviderConfigured(input.platform),
        };
      }),

    getConfiguredProviders: publicProcedure.query(() => {
      const providers = ["figma", "framer"].filter(p =>
        oauthService.isProviderConfigured(p as "figma" | "framer")
      );

      return {
        providers: providers as ("figma" | "framer")[],
      };
    }),
  }),

  generateDesign: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        fileId: z.string(),
        platform: z.enum(["figma", "framer", "canva"]).default("figma"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const provider = mcp.getProvider(input.platform);
      if (!provider) {
        throw new Error(`Provider ${input.platform} is not available. Please wait for initialization or check server logs.`);
      }

      const accessToken = ctx.user.accessToken;
      if (!accessToken) {
        throw new Error(`No access token available for ${input.platform}. Please re-authenticate.`);
      }

      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      jobManager.create(taskId);
      jobManager.setStatus(taskId, "running", {
        result: { message: "Planning design..." },
      });

      setImmediate(async () => {
        try {
          const workflow = createWorkflow();
          await workflow.invoke({
            taskId,
            prompt: input.prompt,
            fileId: input.fileId,
            platform: input.platform,
            accessToken: accessToken,
            steps: [],
            executedSteps: [],
            currentStep: 0,
            finalMessage: null,
            messages: [],
          });
        } catch (error) {
          workflowEmitter.emit({
            type: "failed",
            taskId,
            message: "Workflow execution failed",
            error: (error as Error).message,
          });
          jobManager.setStatus(taskId, "failed", {
            error: (error as Error).message,
          });
        }
      });

      return { taskId, status: "started", userId: ctx.user.userId };
    }),

  executeMCPTask: protectedProcedure
    .input(
      z.object({
        provider: z.enum(["figma", "framer", "canva"]),
        action: z.string(),
        payload: z.record(z.any()),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const provider = mcp.getProvider(input.provider);
      if (!provider) {
        throw new Error(`Provider ${input.provider} is not available. Please wait for initialization.`);
      }

      const taskId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      jobManager.create(taskId);
      jobManager.setStatus(taskId, "running", {
        result: { message: `Executing ${input.action} on ${input.provider}` },
      });

      try {
        const payload = {
          ...input.payload,
          accessToken: input.payload.accessToken || ctx.user.accessToken
        };

        const result = await mcp.execute({
          id: taskId,
          provider: input.provider,
          action: input.action,
          payload: payload,
        });

        jobManager.setStatus(taskId, "completed", { result: result.data });
        return { taskId, result };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`MCP task execution failed:`, error);
        jobManager.setStatus(taskId, "failed", {
          error: errorMessage,
        });
        throw new Error(`MCP execution failed: ${errorMessage}`);
      }
    }),

  getJobStatus: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = jobManager.get(input.jobId);
      if (!job) return { status: "not_found" as const };
      return job;
    }),

  getFigmaEmbed: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        const figmaProvider = mcp.getProvider('figma');

        if (!figmaProvider) {
          console.warn('Figma provider not available');
          return {
            error: 'Figma provider not available. Server may still be initializing.',
            fileId: input.fileId,
            embedUrl: null,
            timestamp: new Date().toISOString()
          };
        }

        const accessToken = ctx.user.accessToken;

        if (!accessToken) {
          console.warn('No access token available for Figma embed');
          return {
            error: 'No access token available. Please authenticate with Figma.',
            fileId: input.fileId,
            embedUrl: null,
            timestamp: new Date().toISOString()
          };
        }

        if (typeof (figmaProvider as any).getEmbedUrl !== 'function') {
          console.warn('Figma provider does not support getEmbedUrl method');

          const embedUrl = `https://www.figma.com/embed?embed_host=superdesign&url=https://www.figma.com/file/${input.fileId}`;

          return {
            embedUrl,
            fileId: input.fileId,
            timestamp: new Date().toISOString(),
            note: 'Using basic embed URL (provider method not available)'
          };
        }

        const embedUrl = await (figmaProvider as any).getEmbedUrl(input.fileId, accessToken);

        return {
          embedUrl,
          fileId: input.fileId,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to get Figma embed URL:`, error);

        const fallbackEmbedUrl = `https://www.figma.com/embed?embed_host=superdesign&url=https://www.figma.com/file/${input.fileId}`;

        return {
          error: `Failed to get Figma embed URL: ${errorMessage}`,
          fileId: input.fileId,
          embedUrl: fallbackEmbedUrl,
          timestamp: new Date().toISOString(),
          note: 'Using fallback embed URL due to error'
        };
      }
    }),

  testMCPConnection: publicProcedure
    .input(z.object({
      provider: z.enum(["figma", "framer", "canva"]).optional()
    }))
    .query(({ input }) => {
      const provider = input.provider;

      if (provider) {
        const providerInstance = mcp.getProvider(provider);
        return {
          provider,
          available: !!providerInstance,
          connected: providerInstance ? (providerInstance as any).isConnected?.() : false
        };
      }

      const providers = mcp.getProviders();
      const status = providers.map(p => {
        const providerInstance = mcp.getProvider(p);
        return {
          name: p,
          available: !!providerInstance,
          connected: providerInstance ? (providerInstance as any).isConnected?.() : false
        };
      });

      return {
        providers: status,
        totalAvailable: status.filter(p => p.available).length,
        totalConnected: status.filter(p => p.connected).length
      };
    }),
}) satisfies ReturnType<typeof router>;

export type AppRouter = typeof appRouter;