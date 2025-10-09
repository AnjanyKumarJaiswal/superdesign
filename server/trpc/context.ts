import type { inferAsyncReturnType } from "@trpc/server";
import type { Request, Response } from "express";
import type { IncomingMessage } from "http";
import { WebSocket } from "ws";

export function createTRPCContext(opts: {
  req?: Request;
  res?: Response;
} | {
  req?: IncomingMessage;
  res?: WebSocket;
}) {
  return {
    // Add any context you need here
    user: null, // Will be populated from auth when needed
  };
}

export type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;


