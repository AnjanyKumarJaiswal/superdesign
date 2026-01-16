import axios from "axios";
import { ProviderName, OAuthTokenResponse } from "@/types";

// Re-export for backward compatibility
export type { OAuthTokenResponse } from "@/types";

interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  scope: string;
}

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
        "http://localhost:4000/auth/callback/figma",
      authUrl: "https://www.figma.com/oauth",
      tokenUrl: "https://api.figma.com/v1/oauth/token",
      scope: "file_content:read",
    },
    framer: {
      clientId: process.env.FRAMER_CLIENT_ID || "",
      clientSecret: process.env.FRAMER_CLIENT_SECRET || "",
      redirectUri:
        process.env.FRAMER_REDIRECT_URI ||
        "http://localhost:4000/auth/callback/framer",
      authUrl: "https://api.framer.com/oauth/authorize",
      tokenUrl: "https://api.framer.com/oauth/token",
      scope: "read write",
    },
  };

  getAuthorizationUrl(provider: ProviderName, state?: string): string {
    const config = this.configs[provider];

    console.log(`Getting auth URL for ${provider}`);

    if (!config) {
      throw new OAuthError(`Unsupported provider: ${provider}`, provider);
    }

    if (!config.clientId) {
      throw new OAuthError(
        `Missing client ID for ${provider}. Please set ${provider.toUpperCase()}_CLIENT_ID environment variable.`,
        provider,
      );
    }

    const stateParam = state || Math.random().toString(36).substring(2);

    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: config.scope,
      response_type: "code",
      state: stateParam
    });

    const authUrl = `${config.authUrl}?${params.toString()}`;

    console.log(`Generated auth URL for ${provider}`);

    return authUrl;
  }

  async exchangeCodeForToken(
    provider: ProviderName,
    code: string,
  ): Promise<OAuthTokenResponse> {
    const config = this.configs[provider];

    console.log(`Starting token exchange for ${provider}`);

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
      if (!code || code.trim() === '') {
        throw new OAuthError('Authorization code is empty or invalid', provider);
      }

      let tokenResponse;
      if (provider === "figma") {
        tokenResponse = await this.exchangeFigmaToken(config, code);
      } else if (provider === "framer") {
        tokenResponse = await this.exchangeFramerToken(config, code);
      } else {
        throw new OAuthError(`Token exchange not implemented for ${provider}`, provider);
      }

      console.log(`Token exchange successful for ${provider}`);
      return tokenResponse;

    } catch (error) {
      console.error(`Token exchange error for ${provider}:`, error);

      if (axios.isAxiosError(error)) {
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

  private async exchangeFigmaToken(
    config: OAuthConfig,
    code: string,
  ): Promise<OAuthTokenResponse> {
    console.log(`Starting Figma token exchange`);

    const sanitizedCode = code.trim();

    const requestBody = new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code: sanitizedCode,
      grant_type: "authorization_code",
    }).toString();

    try {
      const response = await axios.post(config.tokenUrl, requestBody, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "SuperDesign/1.0"
        },
      });

      console.log(`Figma token exchange success: ${response.status}`);
      const data = response.data;

      if (!data.access_token) {
        throw new Error("Missing access_token in response");
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 7776000,
        tokenType: data.token_type || "Bearer",
        scope: data.scope,
        providerUserId: data.user_id
      };
    } catch (error) {
      console.error(`Figma token exchange failed:`, error);
      throw error;
    }
  }

  private async exchangeFramerToken(
    config: OAuthConfig,
    code: string,
  ): Promise<OAuthTokenResponse> {
    console.log(`Starting Framer token exchange`);

    const sanitizedCode = code.trim();

    try {
      const response = await axios.post(
        config.tokenUrl,
        {
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
          code: sanitizedCode,
          grant_type: "authorization_code",
        },
        {
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "SuperDesign/1.0"
          },
        },
      );

      console.log(`Framer token exchange success: ${response.status}`);
      const data = response.data;

      if (!data.access_token) {
        throw new Error("Missing access_token in response");
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in || 3600,
        tokenType: data.token_type || "Bearer",
        scope: data.scope,
        providerUserId: data.user_id
      };
    } catch (error) {
      console.error(`Framer token exchange failed:`, error);
      throw error;
    }
  }

  isProviderConfigured(provider: ProviderName): boolean {
    const config = this.configs[provider];
    return !!(config && config.clientId && config.clientSecret);
  }
}

export const oauthService = new OAuthService();
