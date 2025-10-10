import jwt from "jsonwebtoken";

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || "7d";
// Special expiration for Figma tokens - 30 minutes
const FIGMA_TOKEN_EXPIRES_IN: string | number = process.env.FIGMA_TOKEN_EXPIRES_IN || "30m";

export interface UserPayload {
  userId: string;
  platform: "figma" | "framer";
  accessToken: string;
  refreshToken?: string;
  tokenExpiry?: number; // Timestamp when token expires
}

export interface JWTPayload extends UserPayload {
  iat: number;
  exp: number;
}

/**
 * Generate a JWT token for authenticated user
 */
export function generateToken(payload: UserPayload): string {
  // For Figma platform, apply special token expiration of 30 minutes
  if (payload.platform === "figma") {
    // Calculate token expiry timestamp (30 minutes from now)
    const tokenExpiry = Date.now() + 30 * 60 * 1000; // 30 minutes in milliseconds
    payload.tokenExpiry = tokenExpiry;
    
    console.log(`Setting Figma token to expire at: ${new Date(tokenExpiry).toISOString()}`);
  }
  
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN, // This is for the JWT itself, not the token inside
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
    console.error("JWT verification error:", error);
    return null;
  }
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
