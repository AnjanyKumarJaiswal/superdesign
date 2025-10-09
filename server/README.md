# SuperDesign Backend Server

A standalone tRPC server with LangGraph orchestration for real-time design generation.

## Features

- **LangGraph Workflow**: Multi-step design orchestration with planner → executor → finalizer
- **Real-time Subscriptions**: tRPC WebSocket subscriptions for live progress updates
- **Unified MCP Server**: Pluggable providers for Figma, Framer, Canva
- **Event-driven Architecture**: Real-time events from MCP providers and workflow steps

## Quick Start

```bash
# Install dependencies
npm install

# Development
npm run dev

# Production
npm run build
npm start
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

## Architecture

1. **LangGraph Workflow**: Plans steps → executes via MCP → finalizes
2. **MCP Providers**: Handle platform-specific API calls (Figma, Framer, Canva)
3. **tRPC Subscriptions**: Stream real-time events to frontend
4. **Event Emitters**: Coordinate between workflow and MCP layers

## Environment Variables

```env
PORT=4000
NODE_ENV=development
```
