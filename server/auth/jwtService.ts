import jwt from "jsonwebtoken";

// JWT configuration
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || "7d";

export interface UserPayload {
  userId: string;
  email?: string;
  platform: "figma" | "framer";
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: number;
}

export interface JWTPayload extends UserPayload {
  iat: number;
  exp: number;
}

/**
 * Generate a JWT token for authenticated user
 */
export function generateToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT token
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      console.error("JWT verification failed:", error.message);
    } else if (error instanceof jwt.TokenExpiredError) {
      console.error("JWT token expired:", error.message);
    }
    return null;
  }
}

/**
 * Decode a token without verification (useful for reading expired tokens)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.decode(token) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("JWT decode failed:", error);
    return null;
  }
}

/**
 * Check if a token is expired
 */
export function isTokenExpired(token: string): boolean {
  const decoded = decodeToken(token);
  if (!decoded) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
}

/**
 * Check if the platform access token is expired
 */
export function isPlatformTokenExpired(payload: UserPayload): boolean {
  const currentTime = Date.now();
  return payload.tokenExpiresAt < currentTime;
}

/**
 * Refresh JWT token with new platform access token
 */
export function refreshJWTWithNewAccessToken(
  oldToken: string,
  newAccessToken: string,
  newRefreshToken?: string,
  newExpiresIn?: number,
): string | null {
  const decoded = decodeToken(oldToken);
  if (!decoded) return null;

  const newPayload: UserPayload = {
    userId: decoded.userId,
    email: decoded.email,
    platform: decoded.platform,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken || decoded.refreshToken,
    tokenExpiresAt: newExpiresIn
      ? Date.now() + newExpiresIn * 1000
      : decoded.tokenExpiresAt,
  };

  return generateToken(newPayload);
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
