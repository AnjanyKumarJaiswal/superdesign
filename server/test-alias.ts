import { mcp } from "@/mcp";
import { createWorkflow } from "@/orchestrator/orchestrator";
import { appRouter } from "@/trpc/router";

console.log("✅ @ alias imports working!");
console.log("MCP providers:", mcp.getProviders());
console.log("Workflow created:", !!createWorkflow);
console.log("tRPC router:", !!appRouter);
