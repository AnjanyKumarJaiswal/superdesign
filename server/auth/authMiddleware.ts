import { Request, Response, NextFunction } from "express";
import { verifyToken, extractTokenFromHeader } from "./jwtService";
import { tokenExpirationService } from "./tokenExpirationService";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    platform: "figma" | "framer";
    accessToken: string;
    refreshToken?: string;
    tokenExpiry?: number;
  };
}

/**
 * Middleware to verify JWT token and attach user to request
 */
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
  
  // Check if token is expired according to our token expiration service
  if (decoded.platform === "figma" && !tokenExpirationService.isTokenValid(decoded.userId, decoded.platform)) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Figma token has expired after 30 minutes. Please re-authenticate.",
      code: "figma_token_expired",
      requiresReauth: true
    });
    return;
  }
  
  // If token is still valid, update remaining time in response headers for client awareness
  if (decoded.platform === "figma") {
    const remainingMs = tokenExpirationService.getTimeRemaining(decoded.userId, decoded.platform);
    res.setHeader('X-Token-Expires-In', Math.floor(remainingMs / 1000).toString());
  }

  // Attach user to request
  req.user = {
    userId: decoded.userId,
    platform: decoded.platform,
    accessToken: decoded.accessToken,
    refreshToken: decoded.refreshToken,
  };

  next();
}

/**
 * Middleware to optionally verify JWT token (does not reject unauthenticated requests)
 */
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
      // Check if token is expired according to our token expiration service
      if (decoded.platform === "figma" && !tokenExpirationService.isTokenValid(decoded.userId, decoded.platform)) {
        console.log(`Figma token expired (optional auth) for user ${decoded.userId}`);
        // Don't set user, treat as not authenticated
        next();
        return;
      }
      
      // If token is still valid, update remaining time in response headers for client awareness
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
