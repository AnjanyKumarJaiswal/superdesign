import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { PluginCommand, CommandResult, PendingCommand } from "@/types"

const LOG = '[PLUGIN-BRIDGE]';

export class FigmaPluginBridge extends EventEmitter {
    private wss: WebSocketServer | null = null;
    private pluginConnection: WebSocket | null = null;
    private pendingCommands: Map<string, PendingCommand> = new Map();
    private port: number;
    private commandTimeout: number = 30000;
    private reconnectInterval: NodeJS.Timeout | null = null;

    constructor(port: number = 3847) {
        super();
        this.port = port;
    }

    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.wss = new WebSocketServer({ port: this.port });

                this.wss.on('listening', () => {
                    resolve();
                });

                this.wss.on('connection', (ws, req) => {
                    this.handleConnection(ws);
                });

                this.wss.on('error', (error) => {
                    console.error(`${LOG} ❌ WebSocket server error:`, error);
                    this.emit('error', error);
                });

            } catch (error) {
                console.error(`${LOG} ❌ Failed to start WebSocket bridge:`, error);
                reject(error);
            }
        });
    }

    private handleConnection(ws: WebSocket): void {
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.handleMessage(ws, message);
            } catch (error) {
                console.error(`${LOG} Failed to parse message:`, error);
            }
        });

        ws.on('close', () => {
            if (ws === this.pluginConnection) {
                console.log(`${LOG} 🔌 Figma plugin disconnected`);
                this.pluginConnection = null;
                this.emit('plugin-disconnected');

                for (const [id, pending] of this.pendingCommands) {
                    clearTimeout(pending.timeout);
                    pending.reject(new Error('Plugin disconnected'));
                    this.pendingCommands.delete(id);
                }
            }
        });

        ws.on('error', (error) => {
            console.error(`${LOG} Connection error:`, error);
        });
    }

    private handleMessage(ws: WebSocket, message: any): void {
        switch (message.type) {
            case 'handshake':
                this.handleHandshake(ws, message);
                break;

            case 'command-result':
                this.handleCommandResult(message);
                break;

            case 'pong':
                break;

            case 'test':
                console.log(`${LOG} Test message received`);
                ws.send(JSON.stringify({ type: 'test-ack', timestamp: Date.now() }));
                break;

            default:
                console.log(`${LOG} Unknown message type: ${message.type}`);
        }
    }

    private handleHandshake(ws: WebSocket, message: any): void {
        console.log(`${LOG} 🤝 Handshake from ${message.client} v${message.version}`);

        if (message.client === 'figma-plugin') {
            this.pluginConnection = ws;
            this.emit('plugin-connected');

            ws.send(JSON.stringify({
                type: 'handshake-ack',
                server: 'superdesign-bridge',
                version: '1.0.0'
            }));

            console.log(`${LOG} ✅ Figma plugin connected`);
        }
    }

    private handleCommandResult(message: any): void {
        const pending = this.pendingCommands.get(message.id);

        if (pending) {
            clearTimeout(pending.timeout);
            this.pendingCommands.delete(message.id);

            if (message.success) {
                console.log(`${LOG} ✓ Command ${message.id} completed`);
                pending.resolve({
                    id: message.id,
                    success: true,
                    data: message.data
                });
            } else {
                console.log(`${LOG} ✗ Command ${message.id} failed: ${message.error}`);
                pending.resolve({
                    id: message.id,
                    success: false,
                    error: message.error
                });
            }
        } else {
            console.warn(`${LOG} Received result for unknown command: ${message.id}`);
        }
    }

    isPluginConnected(): boolean {
        return this.pluginConnection !== null &&
            this.pluginConnection.readyState === WebSocket.OPEN;
    }

    async executeCommand(type: string, params: Record<string, any>): Promise<CommandResult> {
        if (!this.isPluginConnected()) {
            throw new Error('Figma plugin is not connected');
        }

        const command: PluginCommand = {
            id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type,
            params
        };

        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingCommands.delete(command.id);
                reject(new Error(`Command ${type} timed out after ${this.commandTimeout}ms`));
            }, this.commandTimeout);

            this.pendingCommands.set(command.id, {
                command,
                resolve,
                reject,
                timeout
            });

            console.log(`${LOG} 📤 Command: ${type}`);

            this.pluginConnection!.send(JSON.stringify({
                type: 'command',
                command
            }));
        });
    }

    async createRectangle(params: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        color?: string;
        name?: string;
        cornerRadius?: number;
    }): Promise<CommandResult> {
        return this.executeCommand('create_rectangle', params);
    }

    async createEllipse(params: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        color?: string;
        name?: string;
    }): Promise<CommandResult> {
        return this.executeCommand('create_ellipse', params);
    }

    async createText(params: {
        x?: number;
        y?: number;
        text?: string;
        fontSize?: number;
        color?: string;
        fontFamily?: string;
        name?: string;
    }): Promise<CommandResult> {
        return this.executeCommand('create_text', params);
    }

    async createFrame(params: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        color?: string;
        name?: string;
    }): Promise<CommandResult> {
        return this.executeCommand('create_frame', params);
    }

    async createButton(params: {
        x?: number;
        y?: number;
        text?: string;
        backgroundColor?: string;
        textColor?: string;
        width?: number;
        height?: number;
        cornerRadius?: number;
        name?: string;
    }): Promise<CommandResult> {
        return this.executeCommand('create_button', params);
    }

    async modifyNode(nodeId: string, params: {
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        rotation?: number;
        opacity?: number;
        visible?: boolean;
        name?: string;
    }): Promise<CommandResult> {
        return this.executeCommand('modify_node', { nodeId, ...params });
    }

    async setFill(nodeId: string, color: string, opacity?: number): Promise<CommandResult> {
        return this.executeCommand('set_fill', { nodeId, color, opacity });
    }

    async setStroke(nodeId: string, color: string, weight?: number): Promise<CommandResult> {
        return this.executeCommand('set_stroke', { nodeId, color, weight });
    }

    async deleteNode(nodeId: string): Promise<CommandResult> {
        return this.executeCommand('delete_node', { nodeId });
    }

    async groupNodes(nodeIds: string[], name?: string): Promise<CommandResult> {
        return this.executeCommand('group_nodes', { nodeIds, name });
    }

    async cloneNode(nodeId: string, offsetX?: number, offsetY?: number): Promise<CommandResult> {
        return this.executeCommand('clone_node', { nodeId, offsetX, offsetY });
    }

    async ping(): Promise<CommandResult> {
        return this.executeCommand('ping', {});
    }

    async shutdown(): Promise<void> {
        console.log(`${LOG} Shutting down...`);

        for (const [id, pending] of this.pendingCommands) {
            clearTimeout(pending.timeout);
            pending.reject(new Error('Bridge shutting down'));
        }
        this.pendingCommands.clear();

        if (this.pluginConnection) {
            this.pluginConnection.close();
            this.pluginConnection = null;
        }

        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }

        console.log(`${LOG} Shutdown complete`);
    }
}

let bridgeInstance: FigmaPluginBridge | null = null;

export function getPluginBridge(): FigmaPluginBridge {
    if (!bridgeInstance) {
        bridgeInstance = new FigmaPluginBridge(3847);
    }
    return bridgeInstance;
}

export async function startPluginBridge(): Promise<FigmaPluginBridge> {
    const bridge = getPluginBridge();
    await bridge.start();
    return bridge;
}

export async function shutdownPluginBridge(): Promise<void> {
    if (bridgeInstance) {
        await bridgeInstance.shutdown();
        bridgeInstance = null;
    }
}
