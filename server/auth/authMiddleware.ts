import { Response, NextFunction } from "express";
import { verifyToken, extractTokenFromHeader } from "./jwtService";
import { tokenExpirationService } from "./tokenExpirationService";
import type { AuthRequest } from "@/types";

// Re-export for backward compatibility
export type { AuthRequest } from "@/types";

export function authenticateToken(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "No authentication token provided",
    });
    return;
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
    return;
  }

  if (decoded.platform === "figma" && !tokenExpirationService.isTokenValid(decoded.userId, decoded.platform)) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Figma token has expired after 30 minutes. Please re-authenticate.",
      code: "figma_token_expired",
      requiresReauth: true
    });
    return;
  }

  if (decoded.platform === "figma") {
    const remainingMs = tokenExpirationService.getTimeRemaining(decoded.userId, decoded.platform);
    res.setHeader('X-Token-Expires-In', Math.floor(remainingMs / 1000).toString());
  }

  req.user = {
    userId: decoded.userId,
    platform: decoded.platform,
    accessToken: decoded.accessToken,
    refreshToken: decoded.refreshToken,
  };

  next();
}

export function optionalAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      if (decoded.platform === "figma" && !tokenExpirationService.isTokenValid(decoded.userId, decoded.platform)) {
        console.log(`Figma token expired (optional auth) for user ${decoded.userId}`);
        next();
        return;
      }

      if (decoded.platform === "figma") {
        const remainingMs = tokenExpirationService.getTimeRemaining(decoded.userId, decoded.platform);
        res.setHeader('X-Token-Expires-In', Math.floor(remainingMs / 1000).toString());
      }

      req.user = {
        userId: decoded.userId,
        platform: decoded.platform,
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken,
      };
    }
  }

  next();
}
