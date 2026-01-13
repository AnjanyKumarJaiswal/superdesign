import { router, publicProcedure } from "@/trpc";
import { z } from "zod";
import { oauthService, OAuthError } from "@/auth/oauthService";
import { generateToken, } from "@/auth/jwtService";
import { UserPayload } from "@/types/index";

export const OAuthRouter = router({

    //oauth authentication part of the providers
    auth: router({
        getAuthUrl: publicProcedure
            .input(
                z.object({
                    platform: z.enum(["figma", "framer"]),
                    state: z.string().optional(),
                }),
            )
            .query(({ input }) => {
                try {
                    const authUrl = oauthService.getAuthorizationUrl(
                        input.platform,
                        input.state,
                    );
                    return {
                        authUrl,
                        platform: input.platform,
                    };
                } catch (error) {
                    if (error instanceof OAuthError) {
                        throw new Error(`OAuth error: ${error.message}`);
                    }
                    throw error;
                }
            }),

        //manageing callback url for auth
        callback: publicProcedure
            .input(
                z.object({
                    platform: z.enum(["figma", "framer"]),
                    code: z.string(),
                    state: z.string().optional(),
                }),
            )
            .mutation(async ({ input }) => {
                try {
                    const tokenResponse = await oauthService.exchangeCodeForToken(
                        input.platform,
                        input.code,
                    );

                    const userId = `${input.platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

                    const userPayload: UserPayload = {
                        userId,
                        platform: input.platform,
                        accessToken: tokenResponse.accessToken,
                        refreshToken: tokenResponse.refreshToken
                    };

                    const jwt = generateToken(userPayload);

                    return {
                        token: jwt,
                        userId,
                        platform: input.platform,
                        expiresIn: tokenResponse.expiresIn,
                    };
                } catch (error) {
                    if (error instanceof OAuthError) {
                        throw new Error(`${input.platform} OAuth error: ${error.message}`);
                    }
                    throw error;
                }
            }),

        //figma authentication 
        figma: publicProcedure
            .input(
                z.object({
                    code: z.string().optional(),
                    state: z.string().optional(),
                }),
            )
            .mutation(async ({ input }) => {
                try {
                    if (!input.code) {
                        const authUrl = oauthService.getAuthorizationUrl(
                            "figma",
                            input.state,
                        );
                        return {
                            authUrl,
                            accessToken: null,
                            platform: "figma",
                        };
                    }

                    const tokenResponse = await oauthService.exchangeCodeForToken(
                        "figma",
                        input.code,
                    );

                    return {
                        accessToken: tokenResponse.accessToken,
                        refreshToken: tokenResponse.refreshToken,
                        expiresIn: tokenResponse.expiresIn,
                        tokenType: tokenResponse.tokenType,
                        platform: "figma",
                        authUrl: null,
                    };
                } catch (error) {
                    if (error instanceof OAuthError) {
                        throw new Error(`Figma OAuth error: ${error.message}`);
                    }
                    throw error;
                }
            }),

        // framer authentication
        framer: publicProcedure
            .input(
                z.object({
                    code: z.string().optional(),
                    state: z.string().optional(),
                }),
            )
            .mutation(async ({ input }) => {
                try {
                    if (!input.code) {
                        const authUrl = oauthService.getAuthorizationUrl(
                            "framer",
                            input.state,
                        );
                        return {
                            authUrl,
                            accessToken: null,
                            platform: "framer",
                        };
                    }

                    const tokenResponse = await oauthService.exchangeCodeForToken(
                        "framer",
                        input.code,
                    );

                    return {
                        accessToken: tokenResponse.accessToken,
                        refreshToken: tokenResponse.refreshToken,
                        expiresIn: tokenResponse.expiresIn,
                        tokenType: tokenResponse.tokenType,
                        platform: "framer",
                        authUrl: null,
                    };
                } catch (error) {
                    if (error instanceof OAuthError) {
                        throw new Error(`Framer OAuth error: ${error.message}`);
                    }
                    throw error;
                }
            }),

        // refresh token 
        refresh: publicProcedure
            .input(
                z.object({
                    platform: z.enum(["figma", "framer"]),
                    refreshToken: z.string(),
                }),
            )
            .mutation(async ({ input }) => {
                throw new Error('Token refresh is not implemented in simplified OAuth flow');
            }),

        checkProvider: publicProcedure
            .input(
                z.object({
                    platform: z.enum(["figma", "framer"]),
                }),
            )
            .query(({ input }) => {
                return {
                    platform: input.platform,
                    configured: oauthService.isProviderConfigured(input.platform),
                };
            }),

        getConfiguredProviders: publicProcedure.query(() => {
            const providers = ["figma", "framer"].filter(p =>
                oauthService.isProviderConfigured(p as "figma" | "framer")
            );

            return {
                providers: providers as ("figma" | "framer")[],
            };
        }),
    }),
})