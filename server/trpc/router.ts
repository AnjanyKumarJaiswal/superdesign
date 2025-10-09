import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { router, publicProcedure } from "./trpc";
import { createWorkflow, workflowEmitter, type WorkflowEvent } from "@/orchestrator/orchestrator";
import { mcp } from "@/mcp";
import { jobManager } from "@/jobs/jobManager";

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
    figma: publicProcedure
      .input(z.object({
        code: z.string().optional(),
        redirectUri: z.string().optional(),
        state: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!input.code) {
          // Return authorization URL if no code provided
          return { 
            authUrl: `https://www.figma.com/oauth?client_id=figma-client-id&redirect_uri=${encodeURIComponent(input.redirectUri || "http://localhost:3001/auth/callback/figma")}&scope=file_read%20files:write&response_type=code&state=${input.state || ""}`,
            accessToken: null
          };
        }
        
        // Mock token exchange - in production would call Figma API
        return { 
          accessToken: `figma-mock-token-${Date.now()}`, 
          expiresIn: 3600,
          platform: "figma"
        };
      }),
      
    framer: publicProcedure
      .input(z.object({
        code: z.string().optional(),
        redirectUri: z.string().optional(),
        state: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!input.code) {
          // Return authorization URL if no code provided
          return { 
            authUrl: `https://framer.com/oauth?client_id=framer-client-id&redirect_uri=${encodeURIComponent(input.redirectUri || "http://localhost:3001/auth/callback/framer")}&scope=read%20write&response_type=code&state=${input.state || ""}`,
            accessToken: null
          };
        }
        
        // Mock token exchange - in production would call Framer API
        return { 
          accessToken: `framer-mock-token-${Date.now()}`, 
          expiresIn: 3600,
          platform: "framer"
        };
      }),
      
    canva: publicProcedure
      .input(z.object({
        code: z.string().optional(),
        redirectUri: z.string().optional(),
        state: z.string().optional()
      }))
      .mutation(async ({ input }) => {
        if (!input.code) {
          // Return authorization URL if no code provided
          return { 
            authUrl: `https://www.canva.com/oauth?client_id=canva-client-id&redirect_uri=${encodeURIComponent(input.redirectUri || "http://localhost:3001/auth/callback/canva")}&scope=designs:read%20designs:write&response_type=code&state=${input.state || ""}`,
            accessToken: null
          };
        }
        
        // Mock token exchange - in production would call Canva API
        return { 
          accessToken: `canva-mock-token-${Date.now()}`, 
          expiresIn: 3600,
          platform: "canva"
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