# Figma MCP Server Connection Guide

This document explains how to correctly set up the connection between your SuperDesign server and Figma's Model Context Protocol (MCP) server.

## Connection Requirements

To connect to Figma's MCP server, you need:

1. **Figma OAuth App** - For user authentication
2. **MCP Client-Server Connection** - For design operations

## Configuration

Add these environment variables to your `.env` file:

```
# Figma OAuth
FIGMA_CLIENT_ID=your_figma_client_id
FIGMA_CLIENT_SECRET=your_figma_client_secret
FIGMA_REDIRECT_URI=http://localhost:4000/auth/callback/figma

# Figma MCP
FIGMA_MCP_URL=https://www.figma.com/mcp
```

## Troubleshooting MCP Connection Issues

If your application is in embed-only mode (can display designs but not modify them), check these common issues:

### 1. MCP Server URL

Make sure the `FIGMA_MCP_URL` environment variable is set correctly. The Figma MCP server URL may change, so check Figma's documentation for the current URL.

### 2. Authentication

MCP operations require a valid Figma access token. Make sure:
- Your OAuth flow is working correctly
- The access token is being passed to the Figma provider
- The user has appropriate permissions for the file they're trying to modify

### 3. Network Issues

Ensure your server can reach the Figma MCP server:
- Check for firewalls or network restrictions
- Try pinging the server from your application's environment

### 4. Request Format

The MCP protocol requires specific request formats. Check the logs for any errors in the request format.

## Logs to Check

When troubleshooting, look for these log entries:

- "Initializing Figma provider and attempting to connect to MCP server..."
- "Figma provider initialized in embed-only mode" (indicates MCP connection failure)
- "Connected to Figma MCP Server. Available tools: X" (indicates successful connection)

## Testing the Connection

You can test your connection by running:

```typescript
const figmaProvider = new FigmaProvider({
  mcpServerUrl: process.env.FIGMA_MCP_URL
});
await figmaProvider.initialize();
console.log("Is connected:", figmaProvider.isReady());
```

If `isReady()` returns `true`, your MCP connection is working correctly.