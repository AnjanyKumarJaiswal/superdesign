import type { NextAuthConfig } from "next-auth";

// Providers will be added once .env vars are set
const config = {
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Persist provider tokens on initial sign in
      if (account) {
        if (account.access_token) token.accessToken = account.access_token as string;
        if (account.refresh_token) token.refreshToken = account.refresh_token as string;
        if (account.expires_at) token.accessTokenExpires = account.expires_at as number;
        token.provider = account.provider;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose access token to server code via auth()
      (session as any).accessToken = (token as any).accessToken;
      (session as any).provider = (token as any).provider;
      return session;
    },
  },
} satisfies NextAuthConfig;

export default config;


