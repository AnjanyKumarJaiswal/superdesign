import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, Figma, Code, Layers } from "lucide-react";
import gsap from "gsap";
import ArrowLoader from "../components/Loading/ArrowLoader";
import AnimatedWordSelector from "../components/AnimatedWordSelector";
import LoginButton from "../components/LoginButton";

const PromptPage = () => {
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState(null); // "figma", "framer", or null for direct design
  const [showContent, setShowContent] = useState(false);
  const navigate = useNavigate();
  const revealHeaderRef = useRef(null);
  const contentRef = useRef(null);
  const splitTopRef = useRef(null);
  const splitBottomRef = useRef(null);

  useEffect(() => {
    // Trigger reveal animation on mount
    const timer = setTimeout(() => {
      setShowContent(true);

      // Small delay to ensure DOM is ready
      requestAnimationFrame(() => {
        if (!revealHeaderRef.current || !contentRef.current) return;

        // GSAP reveal animation
        const tl = gsap.timeline({
          onComplete: () => {
            // Hide reveal header after animation completes
            if (revealHeaderRef.current) {
              revealHeaderRef.current.style.display = "none";
            }
            // Ensure content is visible after animation
            if (contentRef.current) {
              contentRef.current.style.opacity = "1";
            }
          },
        });

        // Clip path reveal animation
        tl.fromTo(
          revealHeaderRef.current,
          {
            clipPath:
              "polygon(0 0, 100% 0, 100% 50%, 0 50%, 0 50%, 100% 50%, 100% 100%, 0 100%)",
          },
          {
            clipPath:
              "polygon(0 0, 100% 0, 100% 0%, 0 0%, 0 100%, 100% 100%, 100% 100%, 0 100%)",
            duration: 1.2,
            ease: "power4.inOut",
          },
        );

        // Split text animations
        tl.fromTo(
          splitTopRef.current,
          { y: "0%" },
          { y: "-30%", ease: "power3.inOut", duration: 1.2 },
          0,
        );

        tl.fromTo(
          splitBottomRef.current,
          { y: "0%" },
          { y: "30%", ease: "power3.inOut", duration: 1.2 },
          0,
        );

        // Content reveal
        tl.fromTo(
          contentRef.current,
          { y: "50%", opacity: 0 },
          { y: "0%", opacity: 1, ease: "power2.out", duration: 0.8 },
          0.4,
        );
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (prompt.trim()) {
      setIsLoading(true);
    }
  };

  const handleTransitionComplete = () => {
    navigate("/chat", {
      state: { initialPrompt: prompt, platform: selectedPlatform },
    });
  };

  return (
    <>
      {/* Arrow Loading Screen */}
      {isLoading && (
        <ArrowLoader duration={2000} onComplete={handleTransitionComplete} />
      )}

      <div
        className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden"
        style={{
          backgroundColor: "#030014",
          fontFamily: "'Geist Mono', monospace",
        }}
      >
        {/* Reveal Header Overlay */}
        {showContent && (
          <div
            ref={revealHeaderRef}
            className="fixed inset-0 flex items-center justify-center"
            style={{
              backgroundColor: "#ffffff",
              pointerEvents: "none",
              willChange: "transform",
              zIndex: 9999,
            }}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Split top */}
              <div
                ref={splitTopRef}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  clipPath: "inset(0 0 calc(50% - 1px) 0)",
                }}
              >
                <h1 className="text-9xl font-black text-black">SUPERDESIGN</h1>
              </div>
              {/* Split bottom */}
              <div
                ref={splitBottomRef}
                className="absolute inset-0 flex items-center justify-center"
                style={{
                  clipPath: "inset(calc(50% - 1px) 0 0 0)",
                }}
              >
                <h1 className="text-9xl font-black text-black">SUPERDESIGN</h1>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div
          ref={contentRef}
          className="relative"
          style={{ opacity: 0, zIndex: 1 }}
        >
          {/* Login Button - Fixed Position */}
          <div className="fixed top-6 right-6 z-50">
            <LoginButton />
          </div>

          {/* Logo and Brand */}
          <div className="mb-8 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <img
                src="/logo/Logo.png"
                alt="SuperDesign"
                className="h-12 w-12"
              />
              <h2 className="text-3xl font-bold text-white">SuperDesign</h2>
            </div>
            <p className="text-center text-gray-400 text-sm">
              AI-powered design assistant for everyone
            </p>
          </div>

          <div className="w-full max-w-3xl">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-white mr-3" />
              </div>
              <div
                className="flex items-center justify-center mb-4 gap-3"
                style={{ minHeight: "80px" }}
              >
                <h1 className="text-5xl font-black text-white tracking-tight m-0">
                  What do
                </h1>
                <AnimatedWordSelector />
              </div>
              <p className="text-gray-400 text-lg mt-4">
                Create stunning designs or build in Figma & Framer — just
                describe it in plain English.
              </p>
            </div>

            {/* Platform Selection */}
            <div className="mb-6">
              <label className="block text-gray-400 text-sm font-medium mb-3">
                Select Platform
              </label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedPlatform(null)}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-medium transition-all ${
                    selectedPlatform === null
                      ? "bg-white/20 text-white border-2 border-white/40 shadow-lg shadow-white/10"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                  }`}
                >
                  <Layers className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Direct Design</div>
                    <div className="text-xs opacity-70">
                      Social media, flyers, posters
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("figma")}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-medium transition-all ${
                    selectedPlatform === "figma"
                      ? "bg-purple-500/20 text-purple-300 border-2 border-purple-400/40 shadow-lg shadow-purple-500/10"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                  }`}
                >
                  <Figma className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Figma</div>
                    <div className="text-xs opacity-70">
                      UI/UX design projects
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPlatform("framer")}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-medium transition-all ${
                    selectedPlatform === "framer"
                      ? "bg-blue-500/20 text-blue-300 border-2 border-blue-400/40 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20"
                  }`}
                >
                  <Code className="w-5 h-5" />
                  <div className="text-left">
                    <div className="font-semibold">Framer</div>
                    <div className="text-xs opacity-70">
                      Interactive websites
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Prompt Input */}
            <form onSubmit={handleSubmit} className="mb-8">
              <div className="relative group">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    selectedPlatform === "figma"
                      ? "E.g., 'Create a landing page with hero section and features in Figma...'"
                      : selectedPlatform === "framer"
                        ? "E.g., 'Build an animated dashboard in Framer...'"
                        : "E.g., 'Create an Instagram post for my coffee shop's 50% off sale...'"
                  }
                  className="w-full px-6 py-4 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl text-white placeholder-gray-500 focus:outline-none focus:border-white/30 focus:bg-white/10 transition-all resize-none h-32 text-lg"
                  style={{ fontFamily: "'Geist Mono', monospace" }}
                />
                <button
                  type="submit"
                  disabled={!prompt.trim()}
                  className="absolute bottom-4 right-4 p-3 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:cursor-not-allowed rounded-xl transition-all border border-white/10 hover:border-white/30 group"
                >
                  <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
                </button>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-12 text-center">
              <p className="text-gray-500 text-sm">
                Powered by SuperDesign AI • Press{" "}
                <kbd className="px-2 py-1 bg-white/10 rounded text-xs">
                  Enter
                </kbd>{" "}
                to submit
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PromptPage;
