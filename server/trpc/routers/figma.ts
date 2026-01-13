import { router, protectedProcedure } from "@/trpc";
import { z } from "zod";
import { mcp } from "@/mcp";

export const figmaEmbed = router({
    getFigmaEmbed: protectedProcedure
        .input(z.object({ fileId: z.string() }))
        .query(async ({ input, ctx }) => {
            try {
                const figmaProvider = mcp.getProvider('figma');

                if (!figmaProvider) {
                    console.warn('Figma provider not available');
                    return {
                        error: 'Figma provider not available. Server may still be initializing.',
                        fileId: input.fileId,
                        embedUrl: null,
                        timestamp: new Date().toISOString()
                    };
                }

                const accessToken = ctx.user.accessToken;

                if (!accessToken) {
                    console.warn('No access token available for Figma embed');
                    return {
                        error: 'No access token available. Please authenticate with Figma.',
                        fileId: input.fileId,
                        embedUrl: null,
                        timestamp: new Date().toISOString()
                    };
                }

                if (typeof (figmaProvider as any).getEmbedUrl !== 'function') {
                    console.warn('Figma provider does not support getEmbedUrl method');

                    const embedUrl = `https://www.figma.com/embed?embed_host=superdesign&url=https://www.figma.com/file/${input.fileId}`;

                    return {
                        embedUrl,
                        fileId: input.fileId,
                        timestamp: new Date().toISOString(),
                        note: 'Using basic embed URL (provider method not available)'
                    };
                }

                const embedUrl = await (figmaProvider as any).getEmbedUrl(input.fileId, accessToken);

                return {
                    embedUrl,
                    fileId: input.fileId,
                    timestamp: new Date().toISOString()
                };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.error(`Failed to get Figma embed URL:`, error);

                const fallbackEmbedUrl = `https://www.figma.com/embed?embed_host=superdesign&url=https://www.figma.com/file/${input.fileId}`;

                return {
                    error: `Failed to get Figma embed URL: ${errorMessage}`,
                    fileId: input.fileId,
                    embedUrl: fallbackEmbedUrl,
                    timestamp: new Date().toISOString(),
                    note: 'Using fallback embed URL due to error'
                };
            }
        }),
})