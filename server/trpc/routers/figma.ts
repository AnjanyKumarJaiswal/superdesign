import { protectedProcedure } from "@/trpc";
import { z } from "zod";

/**
 * Extracts the file key from a Figma URL or returns the input if it's already a file key
 */
function extractFileKey(input: string): string {
    // If it's already a simple file key (alphanumeric), return as-is
    if (/^[a-zA-Z0-9]+$/.test(input)) {
        return input;
    }

    // Try to extract from various Figma URL formats
    const patterns = [
        // https://www.figma.com/file/FILE_KEY/...
        /figma\.com\/file\/([a-zA-Z0-9]+)/,
        // https://www.figma.com/design/FILE_KEY/...
        /figma\.com\/design\/([a-zA-Z0-9]+)/,
        // https://www.figma.com/proto/FILE_KEY/...
        /figma\.com\/proto\/([a-zA-Z0-9]+)/,
        // https://embed.figma.com/design/FILE_KEY/...
        /embed\.figma\.com\/design\/([a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
            console.log(`[FIGMA-EMBED] Extracted file key "${match[1]}" from URL`);
            return match[1];
        }
    }

    // If no pattern matched, return as-is (might be a file key already)
    console.warn(`[FIGMA-EMBED] Could not extract file key from: ${input}, using as-is`);
    return input;
}

// Export as a direct procedure, not a router
export const figmaEmbed = protectedProcedure
    .input(z.object({ fileId: z.string() }))
    .query(async ({ input, ctx }) => {
        try {
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

            // Extract the actual file key from the input
            const fileKey = extractFileKey(input.fileId);

            // Generate embed URL with the extracted file key
            const embedUrl = `https://embed.figma.com/design/${fileKey}?embed-host=superdesign`;

            console.log(`[FIGMA-EMBED] Generated embed URL for file key: ${fileKey}`);

            return {
                embedUrl,
                fileId: fileKey,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error(`Failed to get Figma embed URL:`, error);

            const fileKey = extractFileKey(input.fileId);
            const fallbackEmbedUrl = `https://www.figma.com/embed?embed_host=superdesign&url=https://www.figma.com/file/${fileKey}`;

            return {
                error: `Failed to get Figma embed URL: ${errorMessage}`,
                fileId: fileKey,
                embedUrl: fallbackEmbedUrl,
                timestamp: new Date().toISOString(),
                note: 'Using fallback embed URL due to error'
            };
        }
    });