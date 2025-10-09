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
  
  const methodColor = req.method === "GET" ? colors.green : 
                      req.method === "POST" ? colors.blue :
                      req.method === "PUT" ? colors.yellow :
                      req.method === "DELETE" ? colors.red : colors.white;
  
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
    `${methodColor}${colors.bright}${req.method}${colors.reset} ` +
    `${colors.cyan}${req.path}${colors.reset}`
  );

  res.on("finish", () => {
    const duration = Date.now() - start;
    const statusColor = res.statusCode >= 500 ? colors.red :
                        res.statusCode >= 400 ? colors.yellow :
                        res.statusCode >= 300 ? colors.cyan :
                        colors.green;
    
    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${statusColor}${res.statusCode}${colors.reset} ` +
      `${colors.cyan}${req.path}${colors.reset} ` +
      `${colors.dim}${duration}ms${colors.reset}`
    );
  });

  next();
});

app.use(cors({
  origin: ["http://localhost:3000", "http://localhost:3001"], 
  credentials: true,
}));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: createTRPCContext,
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` +
    `${colors.magenta}${colors.bright}WS CONNECTED${colors.reset} ` +
    `${colors.dim}from ${req.socket.remoteAddress}${colors.reset}`
  );

  ws.on("close", () => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.yellow}WS DISCONNECTED${colors.reset}`
    );
  });

  ws.on("error", (error) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ` +
      `${colors.red}WS ERROR${colors.reset} ` +
      `${error.message}`
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
    `${colors.green}${colors.bright} SuperDesign tRPC Server${colors.reset}`
  );
  console.log("=".repeat(60));
  console.log(
    `${colors.cyan} HTTP:${colors.reset}       http://localhost:${PORT}/api/trpc`
  );
  console.log(
    `${colors.magenta} WebSocket:${colors.reset}  ws://localhost:${PORT}`
  );
  console.log(
    `${colors.green} Health:${colors.reset}     http://localhost:${PORT}/health`
  );
  console.log("=".repeat(60) + "\n");
  console.log(
    `${colors.dim}Waiting for requests...${colors.reset}\n`
  );
});

// Graceful shutdown
const shutdown = (signal: string) => {
  console.log(
    `\n${colors.yellow}${signal}  received, shutting down gracefully...${colors.reset}`
  );
  wss.close(() => {
    server.close(() => {
      console.log(
        `${colors.green}Server closed successfully${colors.reset}`
      );
      process.exit(0);
    });
  });
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));