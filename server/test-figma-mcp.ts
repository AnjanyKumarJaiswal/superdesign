import { FigmaProvider } from "./providers/figmaProvider";
import { MCPClient } from "./mcp/mcpclient";

async function testFigmaMCP() {
  console.log("🧪 Testing Figma MCP Integration\n");
  console.log("=".repeat(60));

  const accessToken = process.env.FIGMA_TEST_TOKEN;

  if (!accessToken) {
    console.error("Error: FIGMA_TEST_TOKEN not set in environment");
    console.log("\nSet your token:");
    console.log("   export FIGMA_TEST_TOKEN=your_figma_oauth_token");
    console.log("   or add to .env file");
    process.exit(1);
  }

  console.log("✅ Access token found");
  console.log("🔗 MCP Server: https://mcp.figma.com/mcp\n");

  console.log("📋 Test 1: List Available MCP Tools");
  console.log("-".repeat(60));

  try {
    const mcpClient = new MCPClient("https://mcp.figma.com/mcp");
    const toolsResponse = await mcpClient.listTools(accessToken);

    if ('error' in toolsResponse) {
      console.error("❌ Error listing tools:", toolsResponse.error);
    } else {
      console.log("✅ Tools retrieved successfully:");
      console.log(JSON.stringify(toolsResponse.result, null, 2));
    }
  } catch (error) {
    console.error("❌ Exception:", error instanceof Error ? error.message : error);
  }

  console.log("\n");

  console.log("🔧 Test 2: FigmaProvider Initialization");
  console.log("-".repeat(60));

  try {
    const figmaProvider = new FigmaProvider();
    console.log("✅ FigmaProvider initialized successfully");

    const tools = await figmaProvider.getAvailableTools(accessToken);
    console.log("📦 Available tools:", JSON.stringify(tools, null, 2));
  } catch (error) {
    console.error("❌ Exception:", error instanceof Error ? error.message : error);
  }

  console.log("\n");

  const testFileId = process.env.FIGMA_TEST_FILE_ID;

  if (testFileId) {
    console.log("🎨 Test 3: Test MCP Tool Call");
    console.log("-".repeat(60));
    console.log(`📁 File ID: ${testFileId}`);

    try {
      const figmaProvider = new FigmaProvider();

      const result = await figmaProvider.runTask({
        id: "test-1",
        provider: "figma",
        action: "createRectangle",
        payload: {
          fileId: testFileId,
          width: 100,
          height: 100,
          color: "#3B82F6",
          x: 0,
          y: 0,
          accessToken: accessToken
        }
      });

      console.log("📊 Result:", JSON.stringify(result, null, 2));

      if (result.status === "completed") {
        console.log("✅ Rectangle created successfully!");
      } else {
        console.log("⚠️  Task failed:", result.error);
      }
    } catch (error) {
      console.error("❌ Exception:", error instanceof Error ? error.message : error);
    }
  } else {
    console.log("⏭️  Test 3: Skipped (no FIGMA_TEST_FILE_ID provided)");
    console.log("💡 To test MCP tool calls, set FIGMA_TEST_FILE_ID in environment");
  }

  console.log("\n" + "=".repeat(60));
  console.log("🏁 Tests completed\n");
}

testFigmaMCP().catch(console.error);
