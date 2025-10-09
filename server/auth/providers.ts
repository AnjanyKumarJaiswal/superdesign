import type { ProviderName } from "@/mcp/mcp";

// OAuth configuration settings
export const authConfig: Record<ProviderName, {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}> = {
  figma: {
    clientId: process.env.FIGMA_CLIENT_ID || "figma-client-id",
    clientSecret: process.env.FIGMA_CLIENT_SECRET || "figma-client-secret",
    redirectUri: process.env.FIGMA_REDIRECT_URI || "http://localhost:3001/auth/callback/figma",
    authUrl: "https://www.figma.com/oauth",
    tokenUrl: "https://www.figma.com/api/oauth/token",
    scope: "file_read files:write",
  },
  framer: {
    clientId: process.env.FRAMER_CLIENT_ID || "framer-client-id",
    clientSecret: process.env.FRAMER_CLIENT_SECRET || "framer-client-secret",
    redirectUri: process.env.FRAMER_REDIRECT_URI || "http://localhost:3001/auth/callback/framer",
    authUrl: "https://framer.com/oauth",
    tokenUrl: "https://framer.com/api/oauth/token",
    scope: "read write",
  },
  canva: {
    clientId: process.env.CANVA_CLIENT_ID || "canva-client-id",
    clientSecret: process.env.CANVA_CLIENT_SECRET || "canva-client-secret",
    redirectUri: process.env.CANVA_REDIRECT_URI || "http://localhost:3001/auth/callback/canva",
    authUrl: "https://www.canva.com/oauth",
    tokenUrl: "https://api.canva.com/oauth/token",
    scope: "designs:read designs:write",
  },
};

/**
 * Get OAuth authorization URL for a specific provider
 */
export function getAuthUrl(provider: ProviderName, state?: string): string {
  const config = authConfig[provider];
  const stateParam = state ? `&state=${encodeURIComponent(state)}` : '';
  
  return `${config.authUrl}?client_id=${encodeURIComponent(config.clientId)}&redirect_uri=${encodeURIComponent(config.redirectUri)}&scope=${encodeURIComponent(config.scope)}&response_type=code${stateParam}`;
}

/**
 * Exchange OAuth code for access token
 * Note: In a real implementation, this would make an actual HTTP request to the provider's token endpoint
 */
export async function exchangeCodeForToken(provider: ProviderName, code: string): Promise<{ 
  accessToken: string; 
  refreshToken?: string;
  expiresIn: number;
}> {
  // This is a placeholder function - in a real implementation, you would:
  // 1. Make an HTTP request to the provider's token endpoint
  // 2. Exchange the authorization code for tokens
  // 3. Return the tokens and related information
  
  // Mock response for development
  return {
    accessToken: `${provider}-mock-token-${Date.now()}`,
    refreshToken: `${provider}-refresh-token-${Date.now()}`,
    expiresIn: 3600
  };
}