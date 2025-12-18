import { EventEmitter } from 'events';

const DEFAULT_FIGMA_EXPIRY_MS = 30 * 60 * 1000;
const FIGMA_TOKEN_EXPIRY_MS = process.env.FIGMA_TOKEN_EXPIRY
  ? parseInt(process.env.FIGMA_TOKEN_EXPIRY, 10) * 1000
  : DEFAULT_FIGMA_EXPIRY_MS;

interface TokenEntry {
  userId: string;
  platform: string;
  accessToken: string;
  issuedAt: number;
  expiresAt: number;
}

export class TokenExpirationService extends EventEmitter {
  private tokenStore: Map<string, TokenEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private cleanupIntervalMs: number = 60000) {
    super();
    this.startCleanupInterval();
  }

  registerToken(userId: string, platform: string, accessToken: string, expiresInMs: number): void {
    const now = Date.now();
    const tokenKey = this.getTokenKey(userId, platform);

    this.tokenStore.set(tokenKey, {
      userId,
      platform,
      accessToken,
      issuedAt: now,
      expiresAt: now + expiresInMs
    });

    console.log(`Registered ${platform} token for user ${userId}, expires in ${expiresInMs / 1000 / 60} minutes`);
  }

  isTokenValid(userId: string, platform: string): boolean {
    const tokenKey = this.getTokenKey(userId, platform);
    const tokenEntry = this.tokenStore.get(tokenKey);

    if (!tokenEntry) {
      return false;
    }

    return Date.now() < tokenEntry.expiresAt;
  }

  getTimeRemaining(userId: string, platform: string): number {
    const tokenKey = this.getTokenKey(userId, platform);
    const tokenEntry = this.tokenStore.get(tokenKey);

    if (!tokenEntry) {
      return 0;
    }

    const remaining = tokenEntry.expiresAt - Date.now();
    return Math.max(0, remaining);
  }

  expireToken(userId: string, platform: string): void {
    const tokenKey = this.getTokenKey(userId, platform);

    if (this.tokenStore.has(tokenKey)) {
      this.tokenStore.delete(tokenKey);
      this.emit('tokenExpired', { userId, platform });
      console.log(`Manually expired ${platform} token for user ${userId}`);
    }
  }

  private cleanupExpiredTokens(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, entry] of this.tokenStore.entries()) {
      if (now >= entry.expiresAt) {
        this.tokenStore.delete(key);
        this.emit('tokenExpired', { userId: entry.userId, platform: entry.platform });
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      console.log(`Cleaned up ${expiredCount} expired tokens`);
    }
  }

  private startCleanupInterval(): void {
    if (!this.cleanupInterval) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpiredTokens();
      }, this.cleanupIntervalMs);
      console.log(`Token expiration service started, cleanup interval: ${this.cleanupIntervalMs}ms`);
    }
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      console.log('Token expiration service stopped');
    }
  }

  private getTokenKey(userId: string, platform: string): string {
    return `${userId}:${platform}`;
  }
}

export const tokenExpirationService = new TokenExpirationService();