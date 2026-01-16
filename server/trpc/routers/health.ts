import { router, publicProcedure } from "@/trpc";

export const healthRouter = router({

    //detecting all the health status of the server
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

        // Available platforms are now statically defined
        const availablePlatforms = ["figma", "framer", "canva"];

        return {
            ok: true,
            timestamp: new Date().toISOString(),
            endpoints,
            mcp: {
                status: "ready",
                availablePlatforms,
                note: "MCP Server runs on port 3846, platforms connect on-demand"
            }
        };
    }),
});