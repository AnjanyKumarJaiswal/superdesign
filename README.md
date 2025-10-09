# SuperDesign Backend

A standalone tRPC server with LangGraph orchestration for real-time design generation.

## Architecture

- **LangGraph Workflow**: Multi-step design orchestration with planner → executor → finalizer
- **Real-time Subscriptions**: tRPC WebSocket subscriptions for live progress updates
- **Unified MCP Server**: Pluggable providers for Figma, Framer, Canva
- **Event-driven Architecture**: Real-time events from MCP providers and workflow steps

## Quick Start

```bash
cd server
npm install
npm run dev
```

## API Endpoints

### HTTP Endpoints
- `GET /health` - Health check
- `POST /api/trpc/*` - tRPC HTTP procedures

### WebSocket Endpoints
- `ws://localhost:4000` - tRPC WebSocket subscriptions

## tRPC Procedures

### Mutations
- `generateDesign(prompt, fileId, platform?, accessToken?)` - Start LangGraph workflow
- `executeMCPTask(provider, action, payload)` - Direct MCP execution

### Queries
- `health()` - Server health check
- `getProviders()` - List available MCP providers

### Subscriptions
- `onWorkflowEvent(taskId)` - Real-time workflow progress
- `onMCPEvent(taskId?)` - Real-time MCP provider events

## Usage Example

```typescript
// Start a design workflow
const result = await trpc.generateDesign.mutate({
  prompt: "Create a blue sign up button",
  fileId: "figma-file-123",
  platform: "figma"
});

// Subscribe to real-time updates
trpc.onWorkflowEvent.subscribe(
  { taskId: result.taskId },
  {
    onData: (event) => {
      console.log(`${event.type}: ${event.message}`);
    }
  }
);
```

## Environment Variables

```env
PORT=4000
NODE_ENV=development
```

## Project Structure

```
server/
├── index.ts              # Express + WebSocket server entry point
├── package.json          # Standalone server dependencies
├── tsconfig.json         # TypeScript config
├── orchestrator/
│   └── orchestrator.ts   # LangGraph workflow orchestration
├── mcp/
│   ├── mcp.ts           # Unified MCP server
│   └── index.ts         # Provider registration
├── providers/
│   ├── figmaProvider.ts
│   ├── framerProvider.ts
│   └── canvaProvider.ts
├── trpc/
│   ├── router.ts        # tRPC router with subscriptions
│   ├── context.ts       # tRPC context
│   └── procedures.ts    # Legacy procedures
└── jobs/
    └── jobManager.ts    # Job status management
```