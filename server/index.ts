import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { appRouter } from "@/trpc/router";
import { createTRPCContext } from "@/trpc/context";

const app = express();
const server = createServer(app);

// CORS middleware
app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"], // Add your frontend URLs
  credentials: true,
}));

// tRPC middleware for HTTP
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
  })
);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WebSocket server for subscriptions
const wss = new WebSocketServer({ server });

applyWSSHandler({
  wss,
  router: appRouter,
  createContext: createTRPCContext,
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 SuperDesign tRPC Server running on port ${PORT}`);
  console.log(`📡 WebSocket subscriptions available at ws://localhost:${PORT}`);
  console.log(`🔗 HTTP endpoint: http://localhost:${PORT}/api/trpc`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  wss.close(() => {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  wss.close(() => {
    server.close(() => {
      console.log("Server closed");
      process.exit(0);
    });
  });
});
