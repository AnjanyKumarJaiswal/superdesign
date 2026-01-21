# SuperDesign Figma Plugin

This Figma plugin enables AI-powered design generation by connecting to the SuperDesign server.

## Files

- `manifest.json` - Plugin configuration for Figma
- `code.ts` - Main plugin code (runs in Figma sandbox)
- `ui.html` - Plugin UI (shows connection status)
- `package.json` - Build dependencies
- `tsconfig.json` - TypeScript configuration

## Quick Setup

### 1. Install Plugin Dependencies

```bash
cd server/plugin
npm install
```

### 2. Build the Plugin

```bash
npm run build
```

This creates `code.js` from `code.ts`.

### 3. Load Plugin in Figma

1. Open Figma Desktop App
2. Go to **Plugins** → **Development** → **Import plugin from manifest...**
3. Select `server/plugin/manifest.json`

### 4. Run the Plugin

1. Start your SuperDesign server: `yarn dev` (from root)
2. In Figma: **Plugins** → **Development** → **SuperDesign AI**
3. The plugin will auto-connect to `ws://localhost:3847`

## How It Works

```
┌─────────────────┐    WebSocket     ┌─────────────────┐
│  SuperDesign    │ ◄──────────────► │  Figma Plugin   │
│  Server         │    Port 3847     │  (Inside Figma) │
│                 │                  │                 │
│  AI generates   │   Commands:      │  Executes via   │
│  design plan    │   create_rect    │  Figma API      │
│                 │   create_text    │                 │
└─────────────────┘                  └─────────────────┘
```

## Available Commands

The plugin supports these commands from the server:

| Command | Description |
|---------|-------------|
| `create_rectangle` | Create a rectangle shape |
| `create_ellipse` | Create an ellipse/circle |
| `create_text` | Create a text node |
| `create_frame` | Create a frame container |
| `create_button` | Create a complete button |
| `modify_node` | Change node properties |
| `set_fill` | Set fill color |
| `set_stroke` | Set stroke color |
| `delete_node` | Remove a node |
| `group_nodes` | Group nodes together |
| `clone_node` | Duplicate a node |

## Development

Watch mode for auto-rebuild:

```bash
npm run watch
```

## Troubleshooting

### Plugin Not Connecting
- Ensure SuperDesign server is running (`yarn dev`)
- Check that WebSocket bridge is on port 3847
- Try clicking "Connect to Server" in plugin UI

### Commands Not Working
- Make sure Figma has a file open
- Check plugin console for errors (Plugins → Development → Open Console)

### Font Errors
- The plugin uses Inter font by default
- Make sure Inter is available in your Figma account
