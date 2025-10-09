import { Request, Response, NextFunction } from "express";
import { verifyToken, extractTokenFromHeader, isPlatformTokenExpired } from "./jwtService";
import { oauthService } from "./oauthService";
import { refreshJWTWithNewAccessToken } from "./jwtService";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    platform: "figma" | "framer";
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: number;
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

  // Attach user to request
  req.user = {
    userId: decoded.userId,
    email: decoded.email,
    platform: decoded.platform,
    accessToken: decoded.accessToken,
    refreshToken: decoded.refreshToken,
    tokenExpiresAt: decoded.tokenExpiresAt,
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
      req.user = {
        userId: decoded.userId,
        email: decoded.email,
        platform: decoded.platform,
        accessToken: decoded.accessToken,
        refreshToken: decoded.refreshToken,
        tokenExpiresAt: decoded.tokenExpiresAt,
      };
    }
  }

  next();
}

/**
 * Middleware to check and refresh platform access token if expired
 */
export async function refreshPlatformTokenIfNeeded(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    next();
    return;
  }

  // Check if platform access token is expired or about to expire (within 5 minutes)
  const expiryThreshold = Date.now() + 5 * 60 * 1000; // 5 minutes from now
  const needsRefresh = req.user.tokenExpiresAt < expiryThreshold;

  if (needsRefresh && req.user.refreshToken) {
    try {
      console.log(`Refreshing ${req.user.platform} access token for user ${req.user.userId}`);

      const tokenResponse = await oauthService.refreshAccessToken(
        req.user.platform,
        req.user.refreshToken
      );

      // Update user object with new tokens
      req.user.accessToken = tokenResponse.accessToken;
      req.user.refreshToken = tokenResponse.refreshToken || req.user.refreshToken;
      req.user.tokenExpiresAt = Date.now() + tokenResponse.expiresIn * 1000;

      // Generate new JWT and send it in response header for client to update
      const authHeader = req.headers.authorization;
      const oldToken = extractTokenFromHeader(authHeader);

      if (oldToken) {
        const newJWT = refreshJWTWithNewAccessToken(
          oldToken,
          tokenResponse.accessToken,
          tokenResponse.refreshToken,
          tokenResponse.expiresIn
        );

        if (newJWT) {
          res.setHeader("X-New-Token", newJWT);
        }
      }
    } catch (error) {
      console.error("Failed to refresh platform token:", error);
      // Continue with expired token - let the API call fail naturally
    }
  }

  next();
}

/**
 * Combined middleware: authenticate and auto-refresh tokens
 */
export function authenticateAndRefresh(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  authenticateToken(req, res, (err) => {
    if (err) {
      next(err);
      return;
    }
    refreshPlatformTokenIfNeeded(req, res, next);
  });
}
