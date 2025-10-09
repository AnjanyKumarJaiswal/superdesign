import type { inferAsyncReturnType } from "@trpc/server";
import type { Request, Response } from "express";
import type { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { verifyToken, extractTokenFromHeader } from "@/auth/jwtService";

export interface AuthenticatedUser {
  userId: string;
  email?: string;
  platform: "figma" | "framer";
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
}

export function createTRPCContext(
  opts:
    | {
        req?: Request;
        res?: Response;
      }
    | {
        req?: IncomingMessage;
        res?: WebSocket;
      },
) {
  // Extract authorization header for HTTP requests
  let accessToken: string | undefined;
  let user: AuthenticatedUser | null = null;

  if (opts.req) {
    const authHeader =
      "headers" in opts.req && typeof opts.req.headers === "object"
        ? opts.req.headers.authorization
        : undefined;

    if (typeof authHeader === "string") {
      const token = extractTokenFromHeader(authHeader);

      if (token) {
        const decoded = verifyToken(token);

        if (decoded) {
          user = {
            userId: decoded.userId,
            email: decoded.email,
            platform: decoded.platform,
            accessToken: decoded.accessToken,
            refreshToken: decoded.refreshToken,
            tokenExpiresAt: decoded.tokenExpiresAt,
          };

          // Keep legacy accessToken for backward compatibility
          accessToken = decoded.accessToken;
        }
      }
    }
  }

  return {
    accessToken,
    user,
  };
}

export type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;
