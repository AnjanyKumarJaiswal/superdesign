import { z } from "zod";
import { jobManager } from "@/jobs/jobManager";
import { router, publicProcedure } from "@/trpc";

export const jobManaging = router({
    jobStatus: publicProcedure
        .input(z.object({ jobId: z.string() }))
        .query(({ input }) => {
            const job = jobManager.get(input.jobId);
            if (!job) return { status: "not_found" as const };
            return job;
        }),
})