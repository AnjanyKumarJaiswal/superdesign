import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
  Loader2,
  AlertCircle,
} from "lucide-react";
import ChatRevealAnimation from "../components/ChatRevealAnimation";
import { trpc } from "../utils/trpc";
import { isAuthenticated, getCurrentUser } from "../utils/auth";
import LoginButton from "../components/LoginButton";
import FigmaEmbed from "../components/FigmaEmbed";
import "./ChatPage.css";

const ChatPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const authenticated = isAuthenticated();
  const user = getCurrentUser();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showReveal, setShowReveal] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPlatform] = useState(
    location.state?.platform || user?.platform || "figma",
  );
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [fileId, setFileId] = useState(
    () => location.state?.fileId || localStorage.getItem("figma_file_id") || "",
  );
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const cursorPositionRef = useRef(null);

  const generateDesign = trpc.generateDesign.useMutation({
    onSuccess: (data) => {
      console.log("Design generation started:", data);
      setCurrentTaskId(data.taskId);

      const aiMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: `Design generation started! Task ID: ${data.taskId}`,
        taskId: data.taskId,
        status: "running",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);
      setIsGenerating(false);
    },
    onError: (error) => {
      console.error("Design generation failed:", error);

      let errorMessage = error.message;
      if (error.message.includes("Unauthorized")) {
        errorMessage = "Please log in with Figma to generate designs.";
      }

      const errorMsg = {
        id: Date.now() + 1,
        role: "assistant",
        content: `❌ Error: ${errorMessage}`,
        error: true,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, errorMsg]);
      setIsGenerating(false);
    },
  });

  const jobStatus = trpc.getJobStatus.useQuery(
    { jobId: currentTaskId || "" },
    {
      enabled: !!currentTaskId,
      refetchInterval: (data) => {
        if (data?.status === "completed" || data?.status === "failed") {
          return false;
        }
        return 2000;
      },
    },
  );

  useEffect(() => {
    if (jobStatus.data && currentTaskId) {
      setMessages((prev) => {
        const updated = [...prev];
        const messageIndex = updated.findIndex(
          (msg) => msg.taskId === currentTaskId,
        );

        if (messageIndex !== -1) {
          const message = updated[messageIndex];
          message.status = jobStatus.data.status;

          if (jobStatus.data.status === "completed") {
            message.content =
              "✅ Design generated successfully! Check your Figma file.";
          } else if (jobStatus.data.status === "failed") {
            message.content = `❌ Generation failed: ${jobStatus.data.error || "Unknown error"}`;
            message.error = true;
          } else if (jobStatus.data.result?.message) {
            message.content = `⏳ ${jobStatus.data.result.message}`;
          }
        }

        return updated;
      });
    }
  }, [jobStatus.data, currentTaskId]);

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
    if (location.state?.initialPrompt && !messages.length) {
      const initialPrompt = location.state.initialPrompt;
      const platform = location.state?.platform || user?.platform || "figma";

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

      if (!authenticated) {
        const authMessage = {
          id: Date.now() + 1,
          role: "assistant",
          content: "⚠️ Please log in with Figma to generate designs.",
          requiresAuth: true,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, authMessage]);
        setIsGenerating(false);
        return;
      }

      setIsGenerating(true);
      generateDesign.mutate({
        prompt: initialPrompt,
        fileId: fileId,
        platform: platform,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.initialPrompt, messages.length, authenticated, generateDesign]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [input]);

  const handleSendMessage = () => {
    if (!input.trim() || isGenerating) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentInput = input;
    setInput("");

    if (!authenticated) {
      const authMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: "⚠️ Please log in with Figma to generate designs.",
        requiresAuth: true,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, authMessage]);
      return;
    }

    if (!fileId) {
      const promptMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content:
          "📋 Please provide your Figma file ID first. You can update it in the panel on the left side.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, promptMessage]);
      return;
    }

    setIsGenerating(true);
    generateDesign.mutate({
      prompt: currentInput,
      fileId: fileId,
      platform: selectedPlatform,
    });
  };

  const handleFileIdSubmit = () => {
    if (!fileId.trim()) return;

    localStorage.setItem("figma_file_id", fileId.trim());

    const confirmMessage = {
      id: Date.now(),
      role: "assistant",
      content: `✅ Figma file ID saved: ${fileId.trim()}. You can now generate designs!`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, confirmMessage]);
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
    setCurrentTaskId(null);
  };

  if (!authenticated) {
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
          className="min-h-screen flex items-center justify-center"
          style={{
            backgroundColor: "#030014",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          <div className="text-center max-w-md px-6">
            <Figma className="w-16 h-16 text-purple-400 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Authentication Required
            </h2>
            <p className="text-gray-400 mb-8">
              Please log in with your Figma account to start generating designs.
            </p>
            <LoginButton />
            <button
              onClick={() => navigate("/prompt")}
              className="mt-4 text-gray-500 hover:text-gray-300 text-sm"
            >
              ← Back to prompt
            </button>
          </div>
        </div>
      </>
    );
  }

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

        <div
          className={`${sidebarOpen ? "w-full md:w-1/2 lg:w-2/5" : "w-0"
            } transition-all duration-300 flex flex-col border-r border-white/10 bg-black/20 backdrop-blur-sm relative z-10`}
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img src="/logo/Logo.png" alt="SuperDesign" className="h-8 w-8" />
              <h1 className="text-white font-semibold text-lg">Superdesign</h1>
            </div>
            <div className="flex items-center gap-2">
              <LoginButton />
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

          <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Figma className="w-4 h-4 text-purple-400" />
                <label className="text-sm font-medium text-white">
                  Figma File ID
                </label>
              </div>
              {selectedPlatform === "figma" && (
                <div className="text-xs text-purple-400">
                  Live Preview Enabled
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={fileId}
                onChange={(e) => {
                  let value = e.target.value.trim();
                  console.log('Processing input value:', value);

                  try {
                    if (value.includes('figma.com/file/')) {
                      const urlParts = value.split('figma.com/file/');
                      if (urlParts.length > 1) {
                        const fileIdPart = urlParts[1].split('/')[0].split('?')[0];
                        console.log('Extracted file ID from URL:', fileIdPart);
                        value = fileIdPart;
                      }
                    }
                    else if (value.includes('figma.com/proto/')) {
                      const urlParts = value.split('figma.com/proto/');
                      if (urlParts.length > 1) {
                        const fileIdPart = urlParts[1].split('/')[0].split('?')[0];
                        console.log('Extracted file ID from prototype URL:', fileIdPart);
                        value = fileIdPart;
                      }
                    }
                    else if (value.includes('embed.figma.com')) {
                      const match = value.match(/file\/([a-zA-Z0-9]+)/);
                      if (match && match[1]) {
                        console.log('Extracted file ID from embed URL:', match[1]);
                        value = match[1];
                      }
                    }
                  } catch (error) {
                    console.error("Error parsing Figma URL:", error);
                  }

                  console.log('Final file ID:', value);
                  setFileId(value);
                  if (value) {
                    localStorage.setItem("figma_file_id", value);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleFileIdSubmit();
                  }
                }}
                placeholder="paste your Figma file ID or full URL here"
                className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-400/60"
              />
              <button
                onClick={handleFileIdSubmit}
                disabled={!fileId.trim()}
                className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 disabled:bg-white/5 disabled:cursor-not-allowed border border-purple-400/40 rounded-lg text-white text-sm font-medium transition-all"
              >
                {fileId ? "Update" : "Save"}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Find this in your Figma file URL: figma.com/file/
              <span className="text-purple-400">FILE_ID</span>/... or paste the full URL
            </p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${authenticated ? "bg-green-400" : "bg-red-400"}`}
                  ></div>
                  <span
                    className={authenticated ? "text-green-400" : "text-red-400"}
                  >
                    {authenticated ? "Authenticated" : "Not authenticated"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={`w-2 h-2 rounded-full ${fileId ? "bg-green-400" : "bg-yellow-400"}`}
                  ></div>
                  <span className={fileId ? "text-green-400" : "text-yellow-400"}>
                    {fileId ? "File ID set" : "File ID needed"}
                  </span>
                </div>
              </div>
              {fileId && (
                <div className="text-purple-300">
                  <Eye className="w-3.5 h-3.5 inline-block mr-1" />
                  Live preview
                </div>
              )}
            </div>
          </div>

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
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${message.role === "user"
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
                disabled={
                  !input.trim() || isGenerating || !authenticated || !fileId
                }
                className="absolute right-2 bottom-2 p-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed rounded-lg transition-colors"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col relative z-10">
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
              onClick={() => console.log("Download feature not implemented")}
              disabled={messages.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed rounded-lg transition-colors text-white text-sm"
            >
              <Download className="w-4 h-4" />
              Download
            </button>
          </div>

          <div className="flex-1 overflow-auto bg-gradient-to-br from-gray-900/50 to-black/50">
            {selectedPlatform === "figma" && fileId ? (
              <FigmaEmbed
                fileId={fileId}
              />
            ) : messages.length === 0 || !messages[messages.length - 1]?.code ? (
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
