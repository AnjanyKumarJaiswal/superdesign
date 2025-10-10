# SuperDesign

> **AI-powered design orchestration that turns natural language into production-ready designs**

A **Model Context Protocol (MCP) server** with LangGraph orchestration and tRPC API for real-time design generation across multiple platforms.

---

## 🎯 The Problem We're Solving

Modern design workflows are fundamentally broken:

**Fragmented Across Tools** - Designers lose creative momentum constantly switching between Figma for UI, Framer for prototypes, and Canva for marketing assets. Each context switch costs 10-15 minutes of lost focus.

**Drowning in Repetition** - 60% of design time is spent on tedious, low-level tasks: creating basic components, setting up layouts, ensuring pixel-perfect consistency. This creates bottlenecks and slows the journey from idea to tangible design.

**High Barriers for Non-Designers** - Product managers and developers have clear ideas but lack tool proficiency to create initial mockups, leading to communication gaps and slower iteration cycles.

**The gap between "I want a modern login screen" and actually having one shouldn't require 2 hours of manual clicking.**

---

## ✨ Our Solution

SuperDesign is a **unified MCP (Model Context Protocol) server** that orchestrates AI-powered design operations across multiple platforms through a pluggable provider architecture. You describe the outcome in plain English, and our MCP server translates that into precise API calls that build the design in real-time.

**One command. Multiple platforms. Real-time magic.**

### What is MCP?

**Model Context Protocol (MCP)** is an architecture pattern that provides a standardized way for AI agents to interact with external tools and services. Our MCP server acts as a unified abstraction layer that:

- **Standardizes** platform-specific APIs into a common interface
- **Orchestrates** multi-step workflows across different design tools
- **Enables** AI agents to reason about and execute design operations
- **Streams** real-time progress updates back to clients

### What Makes This Different

This isn't a simple prompt-to-image generator. SuperDesign uses an **AI agentic workflow** powered by our MCP server - an intelligent agent that can reason, plan, and use a set of "tools" (MCP providers for Figma, Framer, etc.) to accomplish complex multi-step design tasks.

- 🧠 **Plans** the design strategy (layout, components, hierarchy)
- 🔨 **Executes** precise operations via MCP providers
- ✨ **Refines** based on design principles and best practices
- 📡 **Streams** real-time progress updates via WebSocket

All while you watch the design materialize in an embedded live view - creating a seamless, magical interactive experience.

---

## 🚀 Quick Start
```bash

```bash
cd server
npm install
npm run dev
```

Server starts on `http://localhost:4000` with WebSocket support.

### Prerequisites
- Node.js 18+
- Figma account with OAuth app registered
- Environment variables configured (see below)

### Security Features

#### Token Expiration Management
SuperDesign implements a robust token expiration system:

- **Automatic Expiration**: Figma tokens are automatically expired after 30 minutes for security
- **Server-side Validation**: Token validation happens on the server with real-time status checks
- **Expiration Events**: Client receives warning notifications when tokens are about to expire
- **Auto Re-authentication**: Seamless re-authentication flow when tokens expire
- **Configurable**: Token lifetime can be customized via the `FIGMA_TOKEN_EXPIRY` environment variable
- **Credential Change Detection**: Automatically clears cached tokens when client ID/secret changes
- **Environment Storage**: Option to save OAuth tokens to .env file for development and testing

### Configuration

#### 1. Register Figma OAuth App

1. Go to https://www.figma.com/developers/apps
2. Click **"Create app"**
3. Fill in:
   - **App Name**: SuperDesign (or your choice)
   - **Website URL**: `http://localhost:3000`
   - **Callback URL**: `http://localhost:4000/auth/callback/figma`
4. Save and copy your **Client ID** and **Client Secret**

#### 2. Configure Environment Variables

Create a `.env` file in the `server/` directory:

```env
PORT=4000
NODE_ENV=development

# JWT Configuration (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters-long
JWT_EXPIRES_IN=7d

# Figma OAuth (REQUIRED)
FIGMA_CLIENT_ID=your_figma_client_id_here
FIGMA_CLIENT_SECRET=your_figma_client_secret_here
FIGMA_REDIRECT_URI=http://localhost:4000/auth/callback/figma

# Figma MCP Connection (REQUIRED for design operations)
FIGMA_MCP_URL=https://mcp.figma.com/mcp
CLIENT_URL=http://localhost:5173

# Token Expiration Configuration (Optional)
FIGMA_TOKEN_EXPIRY=1800 # Figma token expiry in seconds (default: 1800 = 30 minutes)

# Token Management (Optional)
SAVE_TOKENS_TO_ENV=false # Set to 'true' to automatically save OAuth tokens to .env file
ADMIN_API_KEY=your_secure_admin_key # Required if using the token save API endpoint

# AI Configuration
OPENAI_API_KEY=your_openai_key_here
```

---

## 📡 API Endpoints

### HTTP Endpoints
- `GET /health` - Health check
- `GET /auth/token/status` - Check token validity and expiration
- `POST /auth/save-token` - Save OAuth tokens to .env file (requires admin API key)
- `POST /api/trpc/*` - tRPC HTTP procedures

### WebSocket Endpoints
- `ws://localhost:4000` - tRPC WebSocket subscriptions for real-time updates

---

## 🔌 tRPC Procedures

### Mutations

**`generateDesign`** - Start an AI-powered design workflow

```typescript
const result = await trpc.generateDesign.mutate({
  prompt: "Create a modern login form with email, password, and Google SSO button",
  fileId: "figma-file-123",
  platform: "figma",
  accessToken?: "optional-user-token"
});

// Returns: { taskId: string, status: string }
```

**What prompts work well:**
- "Create a blue sign up button with rounded corners and shadow"
- "Design a user profile card with avatar, name, bio, and follow button"
- "Build a pricing section with 3 tiers: free, pro, and enterprise"
- "Make a mobile navigation menu with hamburger icon"

**`executeMCPTask`** - Direct MCP execution for advanced use cases

```typescript
await trpc.executeMCPTask.mutate({
  provider: "figma",
  action: "createRectangle",
  payload: {
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    fills: [{ type: 'SOLID', color: { r: 0.2, g: 0.4, b: 0.8 } }]
  }
});
```

### Queries

**`health()`** - Server health check

```typescript
const status = await trpc.health.query();
// Returns: { status: 'ok', timestamp: number }
```

**`getProviders()`** - List available MCP providers

```typescript
const providers = await trpc.getProviders.query();
// Returns: [{ name: 'figma', status: 'active', capabilities: [...] }]
```

### Subscriptions

**`onWorkflowEvent`** - Real-time workflow progress

```typescript
trpc.onWorkflowEvent.subscribe(
  { taskId: result.taskId },
  {
    onData: (event) => {
      console.log(`${event.type}: ${event.message}`);
      // Event types: 'planning' | 'executing' | 'finalizing' | 'complete' | 'error'
    }
  }
);
```

**Event stream example:**
```javascript
{ type: 'planning', message: 'Analyzing design requirements...' }
{ type: 'executing', message: 'Creating button component...' }
{ type: 'finalizing', message: 'Applying design tokens...' }
{ type: 'complete', result: { nodeId: 'xxx', url: '...' } }
```

**`onMCPEvent`** - Real-time MCP provider events

```typescript
trpc.onMCPEvent.subscribe(
  { taskId: result.taskId },
  {
    onData: (event) => {
      console.log(`Provider: ${event.provider}, Action: ${event.action}`);
    }
  }
);
```

---

## 💡 Usage Example

```typescript
import { createTRPCProxyClient, createWSClient, wsLink } from '@trpc/client';

// Setup WebSocket connection
const wsClient = createWSClient({ url: 'ws://localhost:4000' });

const trpc = createTRPCProxyClient({
  links: [wsLink({ client: wsClient })]
});

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
      
      if (event.type === 'complete') {
        console.log('Design complete!', event.result);
      }
    }
  }
);
```

### Advanced Example: Multi-Component Layout

```typescript
const task = await trpc.generateDesign.mutate({
  prompt: `Create a user profile card with:
    - Circular avatar (64px) at the top
    - User name in heading style
    - Bio text in secondary color
    - Follow button at the bottom
    - Card should have subtle border and shadow`,
  fileId: "your-figma-file-id",
  platform: "figma"
});

// Watch it build in real-time through subscriptions
```

---

## 🏗️ Project Structure

```
server/
├── index.ts              # Express + WebSocket server entry point
├── package.json          # Standalone server dependencies
├── tsconfig.json         # TypeScript config
├── .env.example          # Environment template
│
├── orchestrator/
│   └── orchestrator.ts   # LangGraph workflow orchestration
│                         # Multi-agent system: planner → executor → finalizer
│
├── mcp/
│   ├── mcp.ts           # Unified MCP server
│   └── index.ts         # Provider registration
│
├── providers/
│   ├── figmaProvider.ts  # Figma API integration
│   ├── framerProvider.ts # Framer API integration (coming soon)
│   └── canvaProvider.ts  # Canva API integration (coming soon)
│
├── trpc/
│   ├── router.ts        # tRPC router with subscriptions
│   ├── context.ts       # tRPC context
│   └── procedures.ts    # Legacy procedures
│
└── jobs/
    └── jobManager.ts    # Job status management
```

### Key Components Explained

**LangGraph Orchestrator** (`orchestrator/orchestrator.ts`)  
The brain of the operation. Multi-agent workflow where each agent specializes in a specific phase:
- **Planner Agent**: Analyzes your prompt and creates a design strategy
- **Executor Agent**: Makes actual API calls to build the design
- **Finalizer Agent**: Validates output and ensures quality

**MCP Server** (`mcp/mcp.ts`)  
Model Context Protocol server - a pluggable architecture that abstracts platform differences. Register providers once, use them anywhere:
```typescript
mcpServer.registerProvider({
  name: 'figma',
  capabilities: ['createRectangle', 'addText', 'applyAutoLayout'],
  handler: figmaProvider
});
```

**tRPC Router** (`trpc/router.ts`)  
Type-safe API with built-in WebSocket subscriptions. No manual API docs needed - types flow automatically to clients.

**Job Manager** (`jobs/jobManager.ts`)  
Tracks task lifecycle, enables async operations, and provides retry logic for failed operations.

---

## 🛠️ Tech Stack

**Backend Infrastructure**
- Node.js + TypeScript
- Express.js for HTTP server
- tRPC for type-safe APIs
- Zod for runtime validation

**AI & Orchestration**
- LangChain.js / LangGraph.js
- OpenAI GPT-4 for natural language understanding
- Multi-agent workflow architecture

**Real-time Communication**
- WebSocket server
- tRPC subscriptions
- Event-driven architecture

**Deployment**
- Docker containerization
- AWS infrastructure
- Render for backend hosting

---
## 🏗️ System Architecture

SuperDesign follows a modern, event-driven architecture that separates concerns across three distinct layers: Frontend, Backend, and Deployment.


![WhatsApp Image 2025-10-04 at 17 34 20_4d6555d9](https://github.com/user-attachments/assets/5fb1b423-c578-4bd7-a3c2-e45bdebf0fbd)



---


## 🌟 Impact & Vision

### The Market Opportunity

**10x Productivity Boost** - Eliminate hours of repetitive work. Designers spend time on creative decisions, not tool mechanics.

**Democratize Design** - Product managers, developers, and marketers can now contribute to the initial creative process without deep tool expertise.

**Accelerate Time-to-Market** - Go from idea to mockup in minutes instead of hours. Faster iteration cycles mean faster product launches.

### Who Benefits

- **Design Agencies**: Handle more clients with the same team size
- **SaaS Companies**: Rapid prototyping for feature exploration
- **Marketing Teams**: Generate campaign assets on-demand
- **Startups**: Build MVPs without hiring full-time designers

### The Future We're Building

SuperDesign represents a paradigm shift in design workflows - moving from manual manipulation to high-level instruction. Imagine a world where:

- You describe a complete landing page and it materializes in seconds
- Your design system automatically enforces brand guidelines
- Code generation closes the loop from design to production
- Teams collaborate through natural conversation, not tool training

This is just the beginning.

---

## 🤝 Contributing

This project is being actively developed for [Hackathon Name]. We welcome contributions!

**Areas where we'd love help:**
- Additional platform providers (Sketch, InVision)
- Performance optimizations for large design files
- Enhanced AI prompts and design intelligence
- Documentation and examples

---

## 📄 License

MIT License - see LICENSE file for details

---

## 🙏 Acknowledgments

Built with [LangChain](https://langchain.com/), [tRPC](https://trpc.io/), and the Model Context Protocol (MCP) architecture.

---

**Built for [Hackathon Name] 2025**

*Transforming design from manual labor to conversational co-creation.*
