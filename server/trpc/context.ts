import type { inferAsyncReturnType } from "@trpc/server";
import type { Request, Response } from "express";
import type { IncomingMessage } from "http";
import { WebSocket } from "ws";
import { verifyToken, extractTokenFromHeader } from "@/auth/jwtService";
import type { AuthenticatedUser } from "@/types";

// Re-export for backward compatibility
export type { AuthenticatedUser } from "@/types";

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
            platform: decoded.platform,
            accessToken: decoded.accessToken,
            refreshToken: decoded.refreshToken,
          };

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
