import type { inferAsyncReturnType } from "@trpc/server";
import { auth } from "@/auth";

export type CreateContextOptions = {
  req: Request;
};

export async function createTRPCContext(_opts: CreateContextOptions) {
  const session = await auth();
  const accessToken = (session as any)?.accessToken as string | undefined;
  const provider = (session as any)?.provider as string | undefined;
  return { session, accessToken, provider };
}

export type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;


