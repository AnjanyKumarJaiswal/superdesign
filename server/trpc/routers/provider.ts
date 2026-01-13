import { router, publicProcedure } from "@/trpc";
import { mcp } from "@/mcp";

export const providerRouters = router({
    providers: publicProcedure.query(() => {
        const providers = mcp.getProviders();

        return {
            providers,
            count: providers.length,
            available: providers.length > 0
        };
    }),
})