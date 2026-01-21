"use strict";
(() => {
  // code.ts
  figma.showUI(__html__, {
    width: 400,
    height: 550,
    themeColors: true,
    visible: true
    // Explicitly set to true
  });
  function log(message, level = "info") {
    figma.ui.postMessage({
      type: "log",
      data: { message, level, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
    console.log(`[SuperDesign Plugin] ${message}`);
  }
  figma.ui.onmessage = async (msg) => {
    if (msg.type === "execute-command") {
      const command = msg.command;
      const commandType = command.type.replace("plugin_", "");
      log(`Executing: ${commandType}`, "info");
      try {
        const result = await executeCommand(commandType, command.params);
        figma.ui.postMessage({
          type: "command-result",
          data: { id: command.id, success: true, data: result }
        });
        log(`Success: ${commandType}`, "success");
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        figma.ui.postMessage({
          type: "command-result",
          data: { id: command.id, success: false, error: errorMsg }
        });
        log(`Failed: ${errorMsg}`, "error");
      }
    }
  };
  async function executeCommand(type, params) {
    switch (type) {
      case "create_button":
        return await createButton(params);
      case "create_rectangle":
        return await createRectangle(params);
      case "create_text":
        return await createText(params);
      case "set_fill":
        return await setFill(params);
      case "ping":
        return { status: "ok" };
      default:
        throw new Error(`Command not implemented: ${type}`);
    }
  }
  async function createButton(params) {
    const { x = 0, y = 0, width = 120, height = 44, text = "Button", backgroundColor = "#FFFFFF", textColor = "#000000", cornerRadius = 8 } = params;
    const frame = figma.createFrame();
    frame.name = "AI Generated Button";
    frame.resize(width, height);
    frame.x = x;
    frame.y = y;
    frame.fills = [{ type: "SOLID", color: hexToRgb(backgroundColor) }];
    frame.cornerRadius = cornerRadius;
    frame.layoutMode = "HORIZONTAL";
    frame.primaryAxisAlignItems = "CENTER";
    frame.counterAxisAlignItems = "CENTER";
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const textNode = figma.createText();
    textNode.characters = text;
    textNode.fills = [{ type: "SOLID", color: hexToRgb(textColor) }];
    frame.appendChild(textNode);
    figma.currentPage.selection = [frame];
    figma.viewport.scrollAndZoomIntoView([frame]);
    return { id: frame.id };
  }
  async function createRectangle(params) {
    const rect = figma.createRectangle();
    rect.resize(params.width || 100, params.height || 100);
    if (params.color) rect.fills = [{ type: "SOLID", color: hexToRgb(params.color) }];
    figma.currentPage.selection = [rect];
    return { id: rect.id };
  }
  async function createText(params) {
    await figma.loadFontAsync({ family: "Inter", style: "Regular" });
    const text = figma.createText();
    text.characters = params.text || "Hello World";
    return { id: text.id };
  }
  async function setFill(params) {
    const node = figma.getNodeById(params.nodeId);
    if (node && "fills" in node) {
      node.fills = [{ type: "SOLID", color: hexToRgb(params.color) }];
    }
    return { success: true };
  }
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
  }
  log("SuperDesign Plugin Ready", "success");
})();
