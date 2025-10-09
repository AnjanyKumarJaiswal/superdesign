import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { appRouter } from "@/trpc/router";
import { createTRPCContext } from "@/trpc/context";
import { oauthService, OAuthError } from "@/auth/oauthService";
import { generateToken, type UserPayload } from "@/auth/jwtService";

const app = express();
const server = createServer(app);

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
};

app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString();

  const methodColor =
    req.method === "GET"
      ? colors.green
      : req.method === "POST"
        ? colors.blue
        : req.method === "PUT"
          ? colors.yellow
          : req.method === "DELETE"
            ? colors.red
            : colors.white;

  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${methodColor}${colors.bright}${req.method}${colors.reset} ` +
      `${colors.cyan}${req.path}${colors.reset}`,
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor =
      res.statusCode >= 500
        ? colors.red
        : res.statusCode >= 400
          ? colors.yellow
          : res.statusCode >= 300
            ? colors.cyan
            : colors.green;

    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
        `${statusColor}${res.statusCode}${colors.reset} ` +
        `${colors.cyan}${req.path}${colors.reset} ` +
        `${colors.dim}${duration}ms${colors.reset}`,
    );
  });

  next();
});

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:3001",
    ],
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
  }),
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// OAuth callback routes
app.get("/auth/callback/:platform", async (req, res) => {
  const { platform } = req.params;
  const { code, state, error, error_description } = req.query;

  // Handle OAuth errors
  if (error) {
    const errorMsg = error_description || error;
    console.error(`OAuth error for ${platform}:`, errorMsg);
    return res.redirect(
      `http://localhost:5173/auth/callback?error=${encodeURIComponent(String(errorMsg))}&platform=${platform}`,
    );
  }

  if (!code) {
    return res.redirect(
      `http://localhost:5173/auth/callback?error=${encodeURIComponent("No authorization code received")}&platform=${platform}`,
    );
  }

  if (platform !== "figma" && platform !== "framer") {
    return res.redirect(
      `http://localhost:5173/auth/callback?error=${encodeURIComponent("Unsupported platform")}&platform=${platform}`,
    );
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await oauthService.exchangeCodeForToken(
      platform,
      String(code),
    );

    // Generate JWT with embedded access token
    const userId = `${platform}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const userPayload: UserPayload = {
      userId,
      platform,
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken,
      tokenExpiresAt: Date.now() + tokenResponse.expiresIn * 1000,
    };

    const jwt = generateToken(userPayload);

    // Redirect back to frontend with token
    const redirectUrl = `http://localhost:5173/auth/callback?token=${jwt}&platform=${platform}${state ? `&state=${state}` : ""}`;
    res.redirect(redirectUrl);
  } catch (error) {
    console.error(`OAuth callback error for ${platform}:`, error);
    const errorMsg =
      error instanceof OAuthError ? error.message : "Authentication failed";
    res.redirect(
      `http://localhost:5173/auth/callback?error=${encodeURIComponent(errorMsg)}&platform=${platform}`,
    );
  }
});

// Get OAuth authorization URL
app.get("/auth/:platform", (req, res) => {
  const { platform } = req.params;
  const { state } = req.query;

  if (platform !== "figma" && platform !== "framer") {
    return res.status(400).json({ error: "Unsupported platform" });
  }

  try {
    // Generate a random state for CSRF protection if not provided
    const oauthState = state
      ? String(state)
      : Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);

    const authUrl = oauthService.getAuthorizationUrl(platform, oauthState);

    // Debug logging
    console.log(`[OAuth] Redirecting to ${platform} OAuth page`);
    console.log(`[OAuth] Auth URL: ${authUrl}`);
    console.log(`[OAuth] State: ${oauthState}`);

    // Redirect to OAuth provider instead of returning JSON
    res.redirect(authUrl);
  } catch (error) {
    console.error(`Error generating auth URL for ${platform}:`, error);
    const errorMsg =
      error instanceof OAuthError
        ? error.message
        : "Failed to generate auth URL";
    res.status(500).json({ error: errorMsg });
  }
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.magenta}${colors.bright}WS CONNECTED${colors.reset} ` +
      `${colors.dim}from ${req.socket.remoteAddress}${colors.reset}`,
  );

  ws.on("close", () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
        `${colors.yellow}WS DISCONNECTED${colors.reset}`,
    );
  });

  ws.on("error", (error) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
        `${colors.red}WS ERROR${colors.reset} ` +
        `${error.message}`,
    );
  });
});

applyWSSHandler({
  wss,
  router: appRouter,
  createContext: createTRPCContext,
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log("\n" + "=".repeat(60));
  console.log(
    `${colors.green}${colors.bright} SuperDesign tRPC Server${colors.reset}`,
  );
  console.log("=".repeat(60));
  console.log(
    `${colors.cyan} HTTP:${colors.reset}       http://localhost:${PORT}/api/trpc`,
  );
  console.log(
    `${colors.magenta} WebSocket:${colors.reset}  ws://localhost:${PORT}`,
  );
  console.log(
    `${colors.green} Health:${colors.reset}     http://localhost:${PORT}/health`,
  );
  console.log("=".repeat(60));

  // Check OAuth configuration
  const figmaConfigured = !!(
    process.env.FIGMA_CLIENT_ID && process.env.FIGMA_CLIENT_SECRET
  );
  const jwtConfigured = !!process.env.JWT_SECRET;

  console.log("\n" + colors.bright + "OAuth Configuration:" + colors.reset);
  console.log(
    ` Figma:     ${figmaConfigured ? colors.green + "✓ Configured" : colors.red + "✗ Not configured"} ${colors.reset}`,
  );
  console.log(
    ` JWT:       ${jwtConfigured ? colors.green + "✓ Configured" : colors.red + "✗ Not configured"} ${colors.reset}`,
  );

  if (!figmaConfigured || !jwtConfigured) {
    console.log(
      `\n${colors.yellow}⚠ Warning: Missing OAuth configuration${colors.reset}`,
    );
    console.log(
      `${colors.dim}Set FIGMA_CLIENT_ID, FIGMA_CLIENT_SECRET, and JWT_SECRET in .env${colors.reset}`,
    );
  }

  console.log("\n" + "=".repeat(60) + "\n");
  console.log(`${colors.dim}Waiting for requests...${colors.reset}\n`);
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(
    `\n${colors.yellow}${signal}  received, shutting down gracefully...${colors.reset}`,
  );
  wss.close(() => {
    server.close(() => {
      console.log(`${colors.green}Server closed successfully${colors.reset}`);
      process.exit(0);
    });
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
