import {
  MCPMessage,
  MCPResponseMessage,
  MCPErrorMessage
} from '@/utils/types';

export class MCPClient {
  private messageId = 0;
  private serverUrl?: string;

  constructor(serverUrl?: string) {
    this.serverUrl = serverUrl;
  }

  private generateId(): string {
    return `client-${++this.messageId}-${Date.now()}`;
  }

  async sendMessage(message: Omit<MCPMessage, 'id'>): Promise<MCPResponseMessage | MCPErrorMessage> {
    const fullMessage: MCPMessage = {
      id: this.generateId(),
      ...message
    };

    return {
      id: fullMessage.id,
      result: { status: "success", message: "Mock response" }
    };
  }

  async sendMethod(method: string, params?: Record<string, unknown>): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMessage({
      method,
      params: params || {}
    });
  }

  async sendCommand(command: string, params?: Record<string, unknown>): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMessage({
      command,
      params: params || {}
    });
  }

  async getProviders(): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMethod('design/getProviders');
  }

  async getFileInfo(provider: string, fileId: string): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMethod('design/getFileInfo', { provider, fileId });
  }

  async getElementInfo(provider: string, fileId: string, elementId: string): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMethod('design/getElementInfo', { provider, fileId, elementId });
  }

  async listElements(provider: string, fileId: string, pageId?: string): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMethod('design/listElements', { provider, fileId, pageId });
  }

  async getStatus(): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendMethod('design/getStatus');
  }

  async createElement(
    provider: string,
    elementType: string,
    properties?: Record<string, unknown>
  ): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendCommand('design/createElement', { provider, elementType, properties });
  }

  async modifyElement(
    provider: string,
    elementId: string,
    properties: Record<string, unknown>
  ): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendCommand('design/modifyElement', { provider, elementId, properties });
  }

  async deleteElement(
    provider: string,
    elementId: string
  ): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendCommand('design/deleteElement', { provider, elementId });
  }

  async groupElements(
    provider: string,
    elementIds: string[],
    groupName?: string
  ): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendCommand('design/groupElements', { provider, elementIds, groupName });
  }

  async exportDesign(
    provider: string,
    fileId: string,
    format?: string,
    options?: Record<string, unknown>
  ): Promise<MCPResponseMessage | MCPErrorMessage> {
    return this.sendCommand('design/exportDesign', { provider, fileId, format, options });
  }
}