import axios from "axios";
import { ProviderName } from "@/utils/types";

// OAuth configuration for each provider
interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

// OAuth token response
export interface OAuthTokenResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope?: string;
}

// OAuth error
export class OAuthError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "OAuthError";
  }
}

class OAuthService {
  private configs: Record<string, OAuthConfig> = {
    figma: {
      clientId: process.env.FIGMA_CLIENT_ID || "",
      clientSecret: process.env.FIGMA_CLIENT_SECRET || "",
      redirectUri:
        process.env.FIGMA_REDIRECT_URI ||
        "http://localhost:3000/auth/callback/figma",
      authUrl: "https://www.figma.com/oauth",
      tokenUrl: "https://api.figma.com/v1/oauth/token",
      scope: "file_content:read",
    },
    framer: {
      clientId: process.env.FRAMER_CLIENT_ID || "",
      clientSecret: process.env.FRAMER_CLIENT_SECRET || "",
      redirectUri:
        process.env.FRAMER_REDIRECT_URI ||
        "http://localhost:3000/auth/callback/framer",
      authUrl: "https://api.framer.com/oauth/authorize",
      tokenUrl: "https://api.framer.com/oauth/token",
      scope: "read write",
    },
  };

  /**
   * Generate OAuth authorization URL for a provider
   */
  getAuthorizationUrl(provider: ProviderName, state?: string): string {
    const config = this.configs[provider];

    // Debug logging
    console.log(`[OAuth Debug] Getting auth URL for ${provider}`);
    console.log(`[OAuth Debug] Config exists:`, !!config);
    console.log(
      `[OAuth Debug] Client ID from env:`,
      process.env.FIGMA_CLIENT_ID ? "SET" : "NOT SET",
    );
    console.log(
      `[OAuth Debug] Client ID in config:`,
      config?.clientId ? "SET" : "NOT SET",
    );

    if (!config) {
      throw new OAuthError(`Unsupported provider: ${provider}`, provider);
    }

    if (!config.clientId) {
      throw new OAuthError(
        `Missing client ID for ${provider}. Please set ${provider.toUpperCase()}_CLIENT_ID environment variable.`,
        provider,
      );
    }

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      response_type: "code",
    });

    if (state) {
      params.append("state", state);
    }

    return `${config.authUrl}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    provider: ProviderName,
    code: string,
  ): Promise<OAuthTokenResponse> {
    const config = this.configs[provider];

    if (!config) {
      throw new OAuthError(`Unsupported provider: ${provider}`, provider);
    }

    if (!config.clientId || !config.clientSecret) {
      throw new OAuthError(
        `Missing OAuth credentials for ${provider}. Please set ${provider.toUpperCase()}_CLIENT_ID and ${provider.toUpperCase()}_CLIENT_SECRET environment variables.`,
        provider,
      );
    }

    try {
      // Prepare token request based on provider
      const tokenResponse = await this.makeTokenRequest(provider, config, code);

      return tokenResponse;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("[OAuth Error] Status:", error.response?.status);
        console.error("[OAuth Error] URL:", error.config?.url);
        console.error("[OAuth Error] Response data:", error.response?.data);

        const errorMessage =
          error.response?.data?.error_description ||
          error.response?.data?.error ||
          error.message;

        throw new OAuthError(
          `Failed to exchange code for token: ${errorMessage}`,
          provider,
          error.response?.data?.error,
          error.response?.data,
        );
      }

      throw new OAuthError(
        `Unexpected error during token exchange: ${(error as Error).message}`,
        provider,
      );
    }
  }

  /**
   * Make token request to provider
   */
  private async makeTokenRequest(
    provider: ProviderName,
    config: OAuthConfig,
    code: string,
  ): Promise<OAuthTokenResponse> {
    if (provider === "figma") {
      return this.exchangeFigmaToken(config, code);
    } else if (provider === "framer") {
      return this.exchangeFramerToken(config, code);
    }

    throw new OAuthError(
      `Token exchange not implemented for ${provider}`,
      provider,
    );
  }

  /**
   * Exchange Figma authorization code for access token
   */
  private async exchangeFigmaToken(
    config: OAuthConfig,
    code: string,
  ): Promise<OAuthTokenResponse> {
    console.log("[Figma Token Exchange] Starting...");
    console.log("[Figma Token Exchange] Token URL:", config.tokenUrl);
    console.log(
      "[Figma Token Exchange] Client ID:",
      config.clientId ? "SET" : "NOT SET",
    );
    console.log("[Figma Token Exchange] Code received:", code ? "YES" : "NO");
    console.log("[Figma Token Exchange] Code length:", code?.length);

    const requestBody = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: code,
      grant_type: "authorization_code",
    }).toString();

    console.log(
      "[Figma Token Exchange] Request body:",
      requestBody.replace(config.clientSecret, "***"),
    );

    const response = await axios.post(config.tokenUrl, requestBody, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    console.log("[Figma Token Exchange] Response status:", response.status);
    const data = response.data;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 7776000, // Figma tokens expire in 90 days
      tokenType: data.token_type || "Bearer",
      scope: data.scope,
    };
  }

  /**
   * Exchange Framer authorization code for access token
   */
  private async exchangeFramerToken(
    config: OAuthConfig,
    code: string,
  ): Promise<OAuthTokenResponse> {
    const response = await axios.post(
      config.tokenUrl,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code: code,
        grant_type: "authorization_code",
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = response.data;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in || 3600,
      tokenType: data.token_type || "Bearer",
      scope: data.scope,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(
    provider: ProviderName,
    refreshToken: string,
  ): Promise<OAuthTokenResponse> {
    const config = this.configs[provider];

    if (!config) {
      throw new OAuthError(`Unsupported provider: ${provider}`, provider);
    }

    if (!config.clientId || !config.clientSecret) {
      throw new OAuthError(
        `Missing OAuth credentials for ${provider}`,
        provider,
      );
    }

    try {
      const response = await axios.post(
        config.tokenUrl,
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const data = response.data;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || refreshToken,
        expiresIn: data.expires_in,
        tokenType: data.token_type || "Bearer",
        scope: data.scope,
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new OAuthError(
          `Failed to refresh token: ${error.response?.data?.error_description || error.message}`,
          provider,
          error.response?.data?.error,
        );
      }

      throw new OAuthError(
        `Unexpected error during token refresh: ${(error as Error).message}`,
        provider,
      );
    }
  }

  /**
   * Revoke access token
   */
  async revokeToken(provider: ProviderName, token: string): Promise<void> {
    const config = this.configs[provider];

    if (!config) {
      throw new OAuthError(`Unsupported provider: ${provider}`, provider);
    }

    // Note: Figma and Framer may not have token revocation endpoints
    // This is a placeholder for future implementation
    console.log(`Token revocation not implemented for ${provider}`);
  }

  /**
   * Validate if provider credentials are configured
   */
  isProviderConfigured(provider: ProviderName): boolean {
    const config = this.configs[provider];
    return !!(config && config.clientId && config.clientSecret);
  }

  /**
   * Get list of configured providers
   */
  getConfiguredProviders(): ProviderName[] {
    return Object.keys(this.configs).filter((provider) =>
      this.isProviderConfigured(provider as ProviderName),
    ) as ProviderName[];
  }
}

// Export singleton instance
export const oauthService = new OAuthService();
