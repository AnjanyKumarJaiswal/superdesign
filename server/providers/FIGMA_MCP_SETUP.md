# Figma MCP Integration Guide

This document explains how the Figma Provider integrates with the Model Context Protocol (MCP) to communicate with Figma's API.

## Overview

The `FigmaProvider` class now includes an MCP client that connects to a Figma MCP server, enabling standardized communication with Figma's REST API through the MCP protocol.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  tRPC Router    │         │  FigmaProvider   │         │  Figma MCP      │
│  (Your App)     │────────>│  (MCP Client)    │────────>│  Server         │
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     │                            │
                                     │                            │
                                     v                            v
                            ┌──────────────────┐         ┌─────────────────┐
                            │  Task Queue      │         │  Figma REST API │
                            │  & Events        │         │                 │
                            └──────────────────┘         └─────────────────┘
```

## Setup Instructions

### 1. Install Figma MCP Server

The Figma MCP server is available via npm:

```bash
npm install -g @modelcontextprotocol/server-figma
```

Or use it directly with `npx` (recommended):

```bash
npx -y @modelcontextprotocol/server-figma
```

### 2. Configure Environment Variables

Add the following to your `server/.env` file:

```env
# Figma Access Token (from OAuth or Personal Access Token)
FIGMA_ACCESS_TOKEN=your_figma_access_token_here

# Optional: Override MCP server command
FIGMA_MCP_SERVER_COMMAND=npx
FIGMA_MCP_SERVER_ARGS=-y,@modelcontextprotocol/server-figma
```

### 3. How It Works

The `FigmaProvider` automatically:

1. **Spawns MCP Server**: Creates a subprocess running the Figma MCP server
2. **Connects via stdio**: Uses `StdioClientTransport` for communication
3. **Maps Actions to Tools**: Translates your task actions to MCP tool calls
4. **Handles Responses**: Processes MCP responses and emits events

## Usage Examples

### Basic Task Execution

```typescript
import { mcp } from "@/mcp";

// Execute a task through the Figma provider
const result = await mcp.execute({
  id: "task-123",
  provider: "figma",
  action: "createElement",
  payload: {
    fileId: "your-figma-file-id",
    accessToken: "user-access-token",
    elementType: "rectangle",
    properties: {
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      fills: [{ type: "SOLID", color: { r: 0, g: 0.5, b: 1 } }]
    }
  }
});
```

### Available Actions

The FigmaProvider maps these actions to MCP tools:

| Action | MCP Tool | Description |
|--------|----------|-------------|
| `createElement` | `figma_create_node` | Create a new node/element |
| `createRectangle` | `figma_create_rectangle` | Create a rectangle shape |
| `createText` | `figma_create_text` | Create a text layer |
| `createFrame` | `figma_create_frame` | Create a frame container |
| `modifyElement` | `figma_update_node` | Update node properties |
| `deleteElement` | `figma_delete_node` | Delete a node |
| `getFileInfo` | `figma_get_file` | Get file metadata |
| `listElements` | `figma_list_nodes` | List nodes in file |
| `exportElement` | `figma_export_image` | Export node as image |
| `groupElements` | `figma_group_nodes` | Group multiple nodes |

## Authentication Flow

### With OAuth (Recommended)

```typescript
// User logs in via OAuth
const { token } = await trpc.auth.callback.mutate({
  platform: "figma",
  code: authorizationCode
});

// Token is stored in JWT
// When executing tasks, pass access token from authenticated user
const result = await trpc.generateDesign.mutate({
  prompt: "Create a blue button",
  fileId: "figma-file-id",
  platform: "figma"
  // accessToken automatically extracted from JWT context
});
```

### With Personal Access Token

```typescript
// Set in environment
FIGMA_ACCESS_TOKEN=your_personal_access_token

// Used as fallback if no user token provided
```

## MCP Client Lifecycle

### Initialization

The MCP client is lazily initialized on first use:

```typescript
const figmaProvider = new FigmaProvider();

// Client connects on first task
await figmaProvider.runTask({
  id: "task-1",
  provider: "figma",
  action: "getFileInfo",
  payload: { fileId: "abc123" }
});
```

### Connection Management

- **Auto-connect**: Client connects automatically when needed
- **Connection pooling**: Reuses existing connection for multiple tasks
- **Reconnection**: Automatically reconnects if connection drops

### Shutdown

```typescript
// Gracefully shutdown the MCP client
await figmaProvider.shutdown();

// Or let process handlers do it automatically
process.on('SIGTERM', async () => {
  await figmaProvider.shutdown();
});
```

## Error Handling

### Connection Errors

```typescript
try {
  await figmaProvider.runTask(task);
} catch (error) {
  if (error.message.includes("MCP client not initialized")) {
    // Connection failed - check if MCP server is accessible
    console.error("Cannot connect to Figma MCP server");
  }
}
```

### Authentication Errors

```typescript
{
  taskId: "task-123",
  status: "failed",
  error: "Missing access_token - please authenticate with Figma first"
}
```

### API Errors

MCP tool errors are returned in the result:

```typescript
{
  taskId: "task-123",
  status: "failed",
  error: "Figma API error: File not found"
}
```

## Events

The FigmaProvider emits events during task execution:

```typescript
figmaProvider.on('taskStart', (task) => {
  console.log('Task started:', task.id);
});

figmaProvider.on('taskProgress', ({ task, progress, data }) => {
  console.log(`Progress: ${progress}`, data);
});

figmaProvider.on('taskComplete', ({ task, result }) => {
  console.log('Task completed:', result);
});

figmaProvider.on('taskError', ({ task, error }) => {
  console.error('Task failed:', error);
});
```

## Advanced Configuration

### Custom MCP Server Command

Override the default MCP server command:

```typescript
// In environment
FIGMA_MCP_SERVER_COMMAND=/usr/local/bin/figma-mcp-server
FIGMA_MCP_SERVER_ARGS=--verbose,--timeout=30000
```

### Timeout Configuration

```typescript
// MCP client will timeout after 30 seconds by default
// Configure in StdioClientTransport options
const transport = new StdioClientTransport({
  command: "npx",
  args: ["-y", "@modelcontextprotocol/server-figma"],
  env: process.env,
  timeout: 30000 // 30 seconds
});
```

## Debugging

### Enable Debug Logging

```bash
# Enable MCP debug output
DEBUG=mcp:* npm run dev
```

### Check Connection Status

```typescript
const status = figmaProvider.getStatus();
console.log('Connected:', status.connected);
console.log('Has client:', status.hasClient);
```

### List Available Tools

```typescript
const tools = await figmaProvider.getAvailableTools();
console.log('Available MCP tools:', tools);
```

## Fallback Mode

If MCP server is not available, the provider can run in simulation mode:

```typescript
// Use simulated mode (no actual Figma API calls)
const result = await figmaProvider.runTaskSimulated(task);
```

This is useful for:
- Development without Figma access
- Testing workflows
- Demo purposes

## Troubleshooting

### "MCP client not initialized"

**Cause**: Cannot connect to Figma MCP server

**Solution**:
1. Check if `@modelcontextprotocol/server-figma` is installed
2. Verify `npx` is available
3. Check network connectivity
4. Try manual installation: `npm install -g @modelcontextprotocol/server-figma`

### "Missing access_token"

**Cause**: No Figma access token provided

**Solution**:
1. Ensure user is authenticated via OAuth
2. Or set `FIGMA_ACCESS_TOKEN` in environment
3. Pass `accessToken` in task payload

### "Figma API error: 403 Forbidden"

**Cause**: Invalid or expired access token

**Solution**:
1. Refresh OAuth token
2. Generate new Personal Access Token
3. Check token scopes include necessary permissions

### MCP Server Crashes

**Cause**: MCP server process terminated unexpectedly

**Solution**:
1. Check system resources (memory, CPU)
2. Review MCP server logs
3. Try restarting the provider: `await figmaProvider.shutdown()` then reinitialize

## Performance Considerations

### Connection Pooling

- MCP client maintains a single connection per provider instance
- Reuses connection for multiple tasks
- No need to manually manage connections

### Task Queuing

- Tasks are processed sequentially through the MCP client
- For parallel execution, create multiple provider instances
- Consider rate limiting to avoid Figma API throttling

### Memory Management

- MCP client uses stdio communication (minimal memory overhead)
- Subprocess automatically cleaned up on shutdown
- No memory leaks from connection pooling

## Security Best Practices

1. **Never hardcode tokens**: Always use environment variables
2. **Use OAuth**: Prefer user-specific tokens over shared PATs
3. **Scope tokens**: Request only necessary Figma API scopes
4. **Rotate tokens**: Implement token refresh logic
5. **Audit access**: Log all Figma API operations

## Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [Figma REST API Docs](https://www.figma.com/developers/api)
- [OAuth Setup Guide](../auth/README.md)
- [UnifiedMCPServer Source](../mcp/mcpserver.ts)

## Support

For issues with:
- **MCP Integration**: Check this documentation
- **Figma OAuth**: See `server/auth/README.md`
- **API Errors**: Consult Figma API documentation
- **General Questions**: Open an issue on GitHub

---

**Last Updated**: January 2025
**Version**: 1.0.0