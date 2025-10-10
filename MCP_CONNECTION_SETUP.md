# Figma MCP Connection Guide

This document explains how to set up and configure the connection between your application and Figma's Model Context Protocol (MCP) server.

## Overview

The FigmaProvider uses the MCP (Model Context Protocol) to communicate with Figma's API, enabling advanced design operations and automation. For proper functionality, your environment must be correctly configured.

## Required Environment Variables

Add these variables to your `.env` file in the `server` directory:

```env
# Figma MCP Connection (REQUIRED for design operations)
FIGMA_MCP_URL=https://mcp.figma.com/mcp
CLIENT_URL=http://localhost:5173

# Figma Access Token (Optional - can be provided per-request)
FIGMA_ACCESS_TOKEN=your_figma_access_token_here
```

## Configuration Explanation

- `FIGMA_MCP_URL`: URL of the Figma MCP server (default: https://mcp.figma.com/mcp)
- `CLIENT_URL`: The URL where your client application is running (used for embed URLs)
- `FIGMA_ACCESS_TOKEN`: Optional default Figma access token for API calls

## Authentication Methods

The Figma MCP connection uses OAuth tokens for authentication. There are two ways to provide them:

1. **Per-request authentication**: Pass the `accessToken` in each task payload (preferred)
2. **Default token**: Set in environment variables (fallback)

## Connection Status

The FigmaProvider operates in two modes:

1. **Full MCP Mode**: Connected to Figma's MCP server, all design operations available
2. **Embed-only Mode**: Limited to generating embed URLs when MCP connection fails

You can check the connection status with:

```typescript
const figmaProvider = new FigmaProvider();
await figmaProvider.initialize();
console.log(`Connected to MCP server: ${figmaProvider.isReady()}`);
```

## Troubleshooting Connection Issues

If you experience connection problems:

1. **Check the MCP URL**: Ensure `FIGMA_MCP_URL` is correctly set
2. **Verify Access Token**: Ensure your OAuth token is valid and has proper scopes
3. **Network Connectivity**: Make sure your server can reach Figma's MCP endpoint
4. **Cross-Origin Issues**: Figma may restrict access based on origin

## Console Output

Look for these log messages to diagnose connection status:

- ✅ "Figma provider initialized successfully with full MCP functionality"
- ⚠️ "Figma provider initialized in embed-only mode"

## Testing Connection

Use this code to test your connection:

```typescript
import { FigmaProvider } from './providers/figmaProvider';

async function testConnection() {
  const provider = new FigmaProvider();
  try {
    await provider.initialize();
    console.log(`MCP Connection: ${provider.isReady() ? 'Connected' : 'Failed'}`);
    
    if (provider.isReady()) {
      // Test calling a simple tool
      const mcpClient = provider.getMCPClient();
      const tools = await mcpClient.listTools();
      console.log(`Available tools: ${tools.length}`);
      console.log(tools.map(t => t.name).join(', '));
    }
  } catch (error) {
    console.error('Connection test failed:', error);
  }
}

testConnection();
```

## Related Documents

- [FIGMA_MCP_SETUP.md](FIGMA_MCP_SETUP.md) - Detailed MCP integration guide
- [OAUTH_SETUP.md](../auth/README.md) - OAuth authentication setup

## Support

If you encounter persistent connection issues, check:
1. Figma API status (https://status.figma.com/)
2. Your network configuration
3. Figma API documentation for any changes to endpoints or authentication