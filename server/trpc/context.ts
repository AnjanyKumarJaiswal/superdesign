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
  // Extract authorization header for HTTP requests
  let accessToken: string | undefined;
  
  if (opts.req) {
    const authHeader = 
      'headers' in opts.req && typeof opts.req.headers === 'object' 
        ? opts.req.headers.authorization 
        : undefined;
    
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.slice(7);
    }
  }
  
  return {
    accessToken,
    user: null, // Can be populated from token verification when needed
  };
}

export type TRPCContext = inferAsyncReturnType<typeof createTRPCContext>;


