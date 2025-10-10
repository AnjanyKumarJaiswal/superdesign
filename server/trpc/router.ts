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
  // Returns all available endpoints and their status
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

    return {
      ok: true,
      timestamp: new Date().toISOString(),
      endpoints,
    };
  }),

  // Get available design platform providers
  getProviders: publicProcedure.query(() => {
    return { providers: mcp.getProviders() };
  }),

  // Platform-specific authentication endpoints
  auth: router({
    // Get OAuth authorization URL
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

    // OAuth callback - exchange code for JWT
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
          // Step 1: Exchange authorization code for access token
          const tokenResponse = await oauthService.exchangeCodeForToken(
            input.platform,
            input.code,
          );

          // Step 2: Generate JWT with embedded access token
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

    // Figma OAuth flow (legacy - kept for backward compatibility)
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
            // Step 1: Return authorization URL
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

          // Step 2: Exchange code for access token
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

    // Framer OAuth flow
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
            // Step 1: Return authorization URL
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

          // Step 2: Exchange code for access token
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

    // Refresh token endpoint - currently disabled in simplified implementation
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

    // Check if provider is configured
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

    // Get all configured providers
    getConfiguredProviders: publicProcedure.query(() => {
      // In simplified implementation, return all providers that are configured
      const providers = ["figma", "framer"].filter(p => 
        oauthService.isProviderConfigured(p as "figma" | "framer")
      );
      
      return {
        providers: providers as ("figma" | "framer")[],
      };
    }),
  }),

  // Generate design with LangGraph workflow (requires authentication)
  generateDesign: protectedProcedure
    .input(
      z.object({
        prompt: z.string(),
        fileId: z.string(),
        platform: z.enum(["figma", "framer", "canva"]).default("figma"),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      // Use access token from authenticated user
      const accessToken = ctx.user.accessToken;
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Create job record
      jobManager.create(taskId);
      jobManager.setStatus(taskId, "running", {
        result: { message: "Planning design..." },
      });

      // Start workflow in background
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

  // Direct MCP execution for running design operations
  executeMCPTask: publicProcedure
    .input(
      z.object({
        provider: z.enum(["figma", "framer", "canva"]),
        action: z.string(),
        payload: z.record(z.any()),
      }),
    )
    .mutation(async ({ input }) => {
      const taskId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Create job record for tracking
      jobManager.create(taskId);
      jobManager.setStatus(taskId, "running", {
        result: { message: `Executing ${input.action} on ${input.provider}` },
      });

      try {
        const result = await mcp.execute({
          id: taskId,
          provider: input.provider,
          action: input.action,
          payload: input.payload,
        });

        jobManager.setStatus(taskId, "completed", { result: result.data });
        return { taskId, result };
      } catch (error) {
        jobManager.setStatus(taskId, "failed", {
          error: (error as Error).message,
        });
        throw error;
      }
    }),

  // Get status of a job/task
  getJobStatus: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = jobManager.get(input.jobId);
      if (!job) return { status: "not_found" as const };
      return job;
    }),
    
  // Get Figma embed URL for a file
  getFigmaEmbed: protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        // Get provider from mcp registry
        const figmaProvider = mcp.getProvider('figma');
        
        if (!figmaProvider) {
          console.warn('Figma provider not available');
          return {
            error: 'Figma provider not available',
            fileId: input.fileId,
            embedUrl: null,
            timestamp: new Date().toISOString()
          };
        }
        
        // Get access token from authenticated user
        const accessToken = ctx.user.accessToken;
        
        if (!accessToken) {
          console.warn('No access token available for Figma embed');
          return {
            error: 'No access token available. Please authenticate with Figma',
            fileId: input.fileId,
            embedUrl: null,
            timestamp: new Date().toISOString()
          };
        }
        
        // Generate embed URL - use the proper typings
        const embedUrl = await (figmaProvider as any).getEmbedUrl(input.fileId, accessToken);
        
        return {
          embedUrl,
          fileId: input.fileId,
          timestamp: new Date().toISOString()
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to get Figma embed URL:`, error);
        // Return a graceful error response instead of throwing
        return {
          error: `Failed to get Figma embed URL: ${errorMessage}`,
          fileId: input.fileId,
          embedUrl: null,
          timestamp: new Date().toISOString()
        };
      }
    }),
}) satisfies ReturnType<typeof router>;

export type AppRouter = typeof appRouter;
