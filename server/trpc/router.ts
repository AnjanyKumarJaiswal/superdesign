import { initTRPC } from "@trpc/server";
import type { TRPCContext } from "./context";
import { taskRouter } from "./procedures";

const t = initTRPC.context<TRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const appRouter = router({
  health: publicProcedure.query(() => ({ ok: true })),
  task: taskRouter,
});

export type AppRouter = typeof appRouter;


