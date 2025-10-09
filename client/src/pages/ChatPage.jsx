import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  Send,
  Plus,
  Menu,
  X,
  Code,
  Eye,
  Download,
  Figma,
  Layers,
  Sparkles,
} from "lucide-react";
import ChatRevealAnimation from "../components/ChatRevealAnimation";
import "./ChatPage.css";

const ChatPage = () => {
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showReveal, setShowReveal] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlatform] = useState(location.state?.platform || null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const cursorPositionRef = useRef(null);

  // Cursor follow effect
  useEffect(() => {
    let targetX = 0,
      targetY = 0;
    let currentX = 0,
      currentY = 0;

    const handleMouseMove = (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const animate = () => {
      currentX += (targetX - currentX) * 0.1;
      currentY += (targetY - currentY) * 0.1;

      if (cursorPositionRef.current) {
        cursorPositionRef.current.style.transform = `translate3d(${currentX}px, ${currentY}px, 0) scale3d(1, 1, 1)`;
      }

      requestAnimationFrame(animate);
    };

    document.addEventListener("mousemove", handleMouseMove);
    const animationId = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, []);

  useEffect(() => {
    if (location.state?.initialPrompt) {
      const initialPrompt = location.state.initialPrompt;
      const platform = location.state?.platform || null;

      const platformText = platform
        ? ` (Platform: ${platform.charAt(0).toUpperCase() + platform.slice(1)})`
        : "";

      const userMessage = {
        id: Date.now(),
        role: "user",
        content: initialPrompt + platformText,
        timestamp: new Date(),
        platform: platform,
      };

      setMessages([userMessage]);
      setIsGenerating(true);

      setTimeout(() => {
        let responseContent = "";
        if (platform === "figma") {
          responseContent = `I'll create "${initialPrompt}" in Figma. Setting up the design file with components and layers...`;
        } else if (platform === "framer") {
          responseContent = `I'll build "${initialPrompt}" in Framer. Creating interactive components with animations...`;
        } else {
          responseContent = `I'll help you create "${initialPrompt}". Here's a design concept with modern UI components.`;
        }

        const aiMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: responseContent,
          code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${initialPrompt}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-4xl font-bold text-white mb-8">${initialPrompt}</h1>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 class="text-2xl font-bold text-white mb-4">Feature 1</h2>
                <p class="text-gray-300">Modern and responsive design</p>
            </div>
            <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 class="text-2xl font-bold text-white mb-4">Feature 2</h2>
                <p class="text-gray-300">Easy to customize</p>
            </div>
            <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 class="text-2xl font-bold text-white mb-4">Feature 3</h2>
                <p class="text-gray-300">Built with best practices</p>
            </div>
        </div>
    </div>
</body>
</html>`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
        setIsGenerating(false);
      }, 2000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  const handleSendMessage = async (messageText = input) => {
    if (!messageText.trim() || isGenerating) return;

    const platformText = selectedPlatform
      ? ` (Platform: ${selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)})`
      : "";

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: messageText + platformText,
      timestamp: new Date(),
      platform: selectedPlatform,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsGenerating(true);

    setTimeout(() => {
      let responseContent = "";
      if (selectedPlatform === "figma") {
        responseContent = `I'll create "${messageText}" in Figma. Setting up the design file with components and layers...`;
      } else if (selectedPlatform === "framer") {
        responseContent = `I'll build "${messageText}" in Framer. Creating interactive components with animations...`;
      } else {
        responseContent = `I'll help you create "${messageText}". Here's a design concept with modern UI components.`;
      }

      const aiMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: responseContent,
        code: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${messageText}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-gray-900 to-gray-800 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <h1 class="text-4xl font-bold text-white mb-8">${messageText}</h1>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 class="text-2xl font-bold text-white mb-4">Feature 1</h2>
                <p class="text-gray-300">Modern and responsive design</p>
            </div>
            <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 class="text-2xl font-bold text-white mb-4">Feature 2</h2>
                <p class="text-gray-300">Easy to customize</p>
            </div>
            <div class="bg-white/10 backdrop-blur-md rounded-lg p-6 border border-white/20">
                <h2 class="text-2xl font-bold text-white mb-4">Feature 3</h2>
                <p class="text-gray-300">Built with best practices</p>
            </div>
        </div>
    </div>
</body>
</html>`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
      setIsGenerating(false);
    }, 2000);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setInput("");
  };

  const downloadCode = () => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.code) {
      const blob = new Blob([lastMessage.code], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "generated-design.html";
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <>
      {showReveal && (
        <ChatRevealAnimation
          duration={3500}
          onComplete={() => {
            setTimeout(() => setShowReveal(false), 1000);
          }}
        />
      )}

      <div
        className="flex h-screen chat-page-wrapper"
        style={{
          fontFamily: "'Geist Mono', monospace",
          animation: showReveal ? "none" : "chatFadeIn 0.8s ease-out",
          opacity: showReveal ? 0 : 1,
        }}
      >
        {/* Grid Background */}
        <div className="pre-footer-grid-chat">
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell reveal"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
          <div className="grid-cell"></div>
        </div>

        <div className="grid-lines-chat">
          <div className="grid-lines-cursor-position" ref={cursorPositionRef}>
            <div className="grid-lines-cursor"></div>
          </div>
        </div>

        {/* Left Sidebar - Chat Panel */}
        <div
          className={`${
            sidebarOpen ? "w-full md:w-1/2 lg:w-2/5" : "w-0"
          } transition-all duration-300 flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-sm relative z-10`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src="/logo/Logo.png" alt="SuperDesign" className="h-8 w-8" />
              <h1 className="text-white font-semibold text-lg">Superdesign</h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewChat}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="New Chat"
              >
                <Plus className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors md:hidden"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Sparkles className="w-12 h-12 text-white/50 mx-auto mb-4" />
                  <p className="text-gray-400 text-sm">
                    Start a conversation to generate designs
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === "user"
                        ? "bg-white/10 text-white border border-white/20"
                        : "bg-white/5 text-gray-200 border border-white/10"
                    }`}
                  >
                    {message.platform && (
                      <div className="flex items-center gap-1.5 mb-2">
                        {message.platform === "figma" && (
                          <>
                            <Figma className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-xs text-purple-400 font-medium">
                              Figma
                            </span>
                          </>
                        )}
                        {message.platform === "framer" && (
                          <>
                            <Code className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-xs text-blue-400 font-medium">
                              Framer
                            </span>
                          </>
                        )}
                        {!message.platform && (
                          <>
                            <Layers className="w-3.5 h-3.5 text-white" />
                            <span className="text-xs text-white font-medium">
                              Direct Design
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    {message.role === "assistant" && message.code && (
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <p className="text-xs text-gray-400">
                          Design generated successfully
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-white/5 border border-white/10 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-white/50 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-white/50 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                    <span className="text-gray-400 text-sm">Generating...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-white/10">
            {selectedPlatform && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-gray-400 text-xs font-medium">
                  Platform:
                </span>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20">
                  {selectedPlatform === "figma" && (
                    <>
                      <Figma className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs text-purple-400 font-medium">
                        Figma
                      </span>
                    </>
                  )}
                  {selectedPlatform === "framer" && (
                    <>
                      <Code className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-blue-400 font-medium">
                        Framer
                      </span>
                    </>
                  )}
                  {!selectedPlatform && (
                    <>
                      <Layers className="w-3.5 h-3.5 text-white" />
                      <span className="text-xs text-white font-medium">
                        Direct Design
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedPlatform === "figma"
                    ? "E.g., 'Create a landing page with hero section and features in Figma...'"
                    : selectedPlatform === "framer"
                      ? "E.g., 'Build an animated dashboard in Framer...'"
                      : "E.g., 'Create an Instagram post for my coffee shop's sale...'"
                }
                className="w-full px-4 py-3 pr-12 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 resize-none max-h-32"
                rows="1"
              />
              <button
                onClick={() => handleSendMessage()}
                disabled={!input.trim() || isGenerating}
                className="absolute right-2 bottom-2 p-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - Canvas */}
        <div className="flex-1 flex flex-col relative z-10">
          {/* Canvas Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5 text-white" />
                </button>
              )}
              <div className="flex gap-2 items-center">
                <Eye className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Preview</span>
              </div>
            </div>
            <button
              onClick={downloadCode}
              disabled={messages.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed rounded-lg transition-colors text-white text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          {/* Canvas Content */}
          <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-900/50 to-black/50">
            {messages.length === 0 || !messages[messages.length - 1]?.code ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="w-16 h-16 text-white/30 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Canvas Preview
                  </h2>
                  <p className="text-gray-400">
                    Your generated designs will appear here
                  </p>
                </div>
              </div>
            ) : (
              <iframe
                srcDoc={messages[messages.length - 1].code}
                className="w-full h-full bg-white"
                title="Preview"
                sandbox="allow-scripts"
              />
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes chatFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
};

export default ChatPage;
