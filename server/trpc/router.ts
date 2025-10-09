import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { createWorkflow, workflowEmitter, type WorkflowEvent } from "@/orchestrator/orchestrator";
import { mcp } from "@/mcp";
import { jobManager } from "@/jobs/jobManager";
import { oauthService, OAuthError } from "@/auth/oauthService";

export const appRouter = router({
  // Returns all available endpoints and their status
  health: publicProcedure.query(() => {
    const endpoints = {
      health: "Active - Returns all available endpoints and their status",
      getProviders: "Active - Returns all supported design platforms",
      auth: {
        figma: "Active - Authenticates with Figma and returns access token",
        framer: "Active - Authenticates with Framer and returns access token",
        canva: "Active - Authenticates with Canva and returns access token"
      },
      generateDesign: "Active - Starts design generation using the specified platform",
      executeMCPTask: "Active - Directly executes tasks on the MCP server",
      getJobStatus: "Active - Returns the status of a specific job"
    };
    
    return { 
      ok: true, 
      timestamp: new Date().toISOString(),
      endpoints 
    };
  }),
  
  // Get available design platform providers
  getProviders: publicProcedure.query(() => {
    return { providers: mcp.getProviders() };
  }),
  
  // Platform-specific authentication endpoints
  auth: router({
    // Figma OAuth flow
    figma: publicProcedure
      .input(z.object({
        code: z.string().optional(),
        state: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        try {
          if (!input.code) {
            // Step 1: Return authorization URL
            const authUrl = oauthService.getAuthorizationUrl("figma", input.state);
            return { 
              authUrl,
              accessToken: null,
              platform: "figma"
            };
          }
          
          // Step 2: Exchange code for access token
          const tokenResponse = await oauthService.exchangeCodeForToken("figma", input.code);
          
          return { 
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
            expiresIn: tokenResponse.expiresIn,
            tokenType: tokenResponse.tokenType,
            platform: "figma",
            authUrl: null
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
      .input(z.object({
        code: z.string().optional(),
        state: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        try {
          if (!input.code) {
            // Step 1: Return authorization URL
            const authUrl = oauthService.getAuthorizationUrl("framer", input.state);
            return { 
              authUrl,
              accessToken: null,
              platform: "framer"
            };
          }
          
          // Step 2: Exchange code for access token
          const tokenResponse = await oauthService.exchangeCodeForToken("framer", input.code);
          
          return { 
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
            expiresIn: tokenResponse.expiresIn,
            tokenType: tokenResponse.tokenType,
            platform: "framer",
            authUrl: null
          };
        } catch (error) {
          if (error instanceof OAuthError) {
            throw new Error(`Framer OAuth error: ${error.message}`);
          }
          throw error;
        }
      }),
      
    // Refresh token endpoint
    refresh: publicProcedure
      .input(z.object({
        platform: z.enum(["figma", "framer"]),
        refreshToken: z.string()
      }))
      .mutation(async ({ input }) => {
        try {
          const tokenResponse = await oauthService.refreshAccessToken(
            input.platform,
            input.refreshToken
          );
          
          return {
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
            expiresIn: tokenResponse.expiresIn,
            tokenType: tokenResponse.tokenType,
            platform: input.platform
          };
        } catch (error) {
          if (error instanceof OAuthError) {
            throw new Error(`Token refresh error: ${error.message}`);
          }
          throw error;
        }
      }),
      
    // Check if provider is configured
    checkProvider: publicProcedure
      .input(z.object({
        platform: z.enum(["figma", "framer"])
      }))
      .query(({ input }) => {
        return {
          platform: input.platform,
          configured: oauthService.isProviderConfigured(input.platform)
        };
      }),
      
    // Get all configured providers
    getConfiguredProviders: publicProcedure
      .query(() => {
        return {
          providers: oauthService.getConfiguredProviders()
        };
      })
  }),

  // Generate design with LangGraph workflow
  generateDesign: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        fileId: z.string(),
        platform: z.enum(["figma", "framer", "canva"]).default("figma"),
        accessToken: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Create job record
      jobManager.create(taskId);
      jobManager.setStatus(taskId, "running", { result: { message: "Planning design..." } });
      
      // Start workflow in background
      setImmediate(async () => {
        try {
          const workflow = createWorkflow();
          await workflow.invoke({
            taskId,
            prompt: input.prompt,
            fileId: input.fileId,
            platform: input.platform,
            accessToken: input.accessToken,
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
          jobManager.setStatus(taskId, "failed", { error: (error as Error).message });
        }
      });

      return { taskId, status: "started" };
    }),

  // Direct MCP execution for running design operations
  executeMCPTask: publicProcedure
    .input(
      z.object({
        provider: z.enum(["figma", "framer", "canva"]),
        action: z.string(),
        payload: z.record(z.any()),
      })
    )
    .mutation(async ({ input }) => {
      const taskId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      // Create job record for tracking
      jobManager.create(taskId);
      jobManager.setStatus(taskId, "running", { result: { message: `Executing ${input.action} on ${input.provider}` } });
      
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
        jobManager.setStatus(taskId, "failed", { error: (error as Error).message });
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
}) satisfies ReturnType<typeof router>;

export type AppRouter = typeof appRouter;