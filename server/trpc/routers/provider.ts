import { router, publicProcedure } from "@/trpc";

export const providerRouters = router({
    providers: publicProcedure.query(() => {
        // Available platforms are now statically defined
        // The actual connection to platform MCP servers happens on-demand
        const providers = ["figma", "framer", "canva"];

        return {
            providers,
            count: providers.length,
            available: true
        };
    }),
});