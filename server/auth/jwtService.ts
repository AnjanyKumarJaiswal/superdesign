import jwt from "jsonwebtoken";
import type { UserPayload, JWTPayload } from "@/types";


const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || "7d";
const FIGMA_TOKEN_EXPIRES_IN: string | number = process.env.FIGMA_TOKEN_EXPIRES_IN || "30m";

export function generateToken(payload: UserPayload): string {
  if (payload.platform === "figma") {
    const tokenExpiry = Date.now() + 30 * 60 * 1000;
    payload.tokenExpiry = tokenExpiry;

    console.log(`Setting Figma token to expire at: ${new Date(tokenExpiry).toISOString()}`);
  }

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error("JWT verification error:", error);
    return null;
  }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}
