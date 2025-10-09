import { z } from "zod";
import { publicProcedure, router } from "./router";
import { mcp } from "@/server/mcp";
import { jobManager } from "@/server/jobs/jobManager";
import { runOrchestration } from "@/server/orchestrator/orchestrator";
import type { TRPCContext } from "./context";

export const taskRouter = router({
  startFigmaTask: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        fileId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accessToken } = ctx as TRPCContext & { accessToken?: string };
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      jobManager.create(jobId);

      // Fire and forget
      (async () => {
        try {
          jobManager.setStatus(jobId, "running");
          await runOrchestration({ taskId: jobId, prompt: input.prompt, fileId: input.fileId, platform: "figma", accessToken });
        } catch (err) {
          jobManager.setStatus(jobId, "failed", { error: (err as Error).message });
        }
      })();

      return { jobId };
    }),
  generateDesign: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        fileId: z.string(),
        platform: z.enum(["figma", "framer", "canva"]).default("figma"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { accessToken } = ctx as TRPCContext & { accessToken?: string };
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      jobManager.create(jobId);

      (async () => {
        try {
          jobManager.setStatus(jobId, "running", { result: { message: "Planning..." } });
          await runOrchestration({
            taskId: jobId,
            prompt: input.prompt,
            fileId: input.fileId,
            platform: input.platform,
            accessToken,
          });
        } catch (err) {
          jobManager.setStatus(jobId, "failed", { error: (err as Error).message });
        }
      })();

      return { jobId };
    }),

  getJobStatus: publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = jobManager.get(input.jobId);
      if (!job) return { status: "not_found" as const };
      return job;
    }),

  listJobs: publicProcedure.query(() => {
    // Not persisted; placeholder could be enhanced later
    return { message: "Listing not persisted in-memory" };
  }),
});


