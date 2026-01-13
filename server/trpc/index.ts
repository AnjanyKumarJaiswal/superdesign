import { initTRPC, TRPCError } from "@trpc/server";
import { type TRPCContext } from "./context";

const trpc = initTRPC.context<TRPCContext>().create();

const isAuthed = trpc.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const router = trpc.router;
export const publicProcedure = trpc.procedure;
export const protectedProcedure = trpc.procedure.use(isAuthed);
export const middleware = trpc.middleware;
