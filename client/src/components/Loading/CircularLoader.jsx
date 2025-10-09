import { useEffect } from "react";

const CircularLoader = ({ onLoadComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onLoadComplete) {
        onLoadComplete();
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [onLoadComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        backgroundColor: "#030014",
        fontFamily: "'Geist Mono', monospace",
        animation: "fadeOut 0.5s ease-out 2.5s forwards",
      }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          perspective: "1000px",
          perspectiveOrigin: "center center",
        }}
      >
        {/* Logo in center */}
        <div
          className="absolute z-50"
          style={{
            width: "120px",
            height: "120px",
            animation: "logoScale3D 2s ease-in-out infinite",
            transform: "translateZ(50px)",
            filter: "drop-shadow(0 10px 20px rgba(0, 0, 0, 0.5))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src="/logo/Logo.png"
            alt="SuperDesign"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
            }}
          />
        </div>

        {/* Outer Circle 1 - Largest */}
        <svg
          viewBox="0 0 500 500"
          className="w-[900px] h-[900px] absolute"
          style={{
            animation:
              "rotateSVG3D 12s linear infinite, divingScale1 4s ease-in-out infinite",
            transformStyle: "preserve-3d",
          }}
        >
          <defs>
            <path
              id="circlePath1"
              d="M 250, 250 m -200, 0 a 200,200 0 1,1 400,0 a 200,200 0 1,1 -400,0"
            />
            <filter id="shadow">
              <feGaussianBlur in="SourceAlpha" stdDeviation="3" />
              <feOffset dx="0" dy="5" result="offsetblur" />
              <feComponentTransfer>
                <feFuncA type="linear" slope="0.5" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <text
            fontSize="32"
            fontWeight="600"
            fill="white"
            filter="url(#shadow)"
            style={{
              fontFamily: "'Geist Mono', monospace",
              opacity: 0.6,
            }}
          >
            <textPath href="#circlePath1" startOffset="0%">
              SuperDesign • SuperDesign • SuperDesign • SuperDesign •
            </textPath>
          </text>
        </svg>

        {/* Middle Circle 2 */}
        <svg
          viewBox="0 0 500 500"
          className="w-[750px] h-[750px] absolute"
          style={{
            animation:
              "rotateReverse3D 10s linear infinite, divingScale2 4s ease-in-out 1s infinite",
            transformStyle: "preserve-3d",
          }}
        >
          <defs>
            <path
              id="circlePath2"
              d="M 250, 250 m -150, 0 a 150,150 0 1,1 300,0 a 150,150 0 1,1 -300,0"
            />
          </defs>
          <text
            fontSize="36"
            fontWeight="bold"
            fill="white"
            filter="url(#shadow)"
            style={{
              fontFamily: "'Geist Mono', monospace",
              opacity: 0.8,
            }}
          >
            <textPath href="#circlePath2" startOffset="0%">
              Design beyond reality • Design beyond reality •
            </textPath>
          </text>
        </svg>

        {/* Inner Circle 3 */}
        <svg
          viewBox="0 0 500 500"
          className="w-[600px] h-[600px] absolute"
          style={{
            animation:
              "rotateSVG3D 8s linear infinite, divingScale3 4s ease-in-out 2s infinite",
            transformStyle: "preserve-3d",
          }}
        >
          <defs>
            <path
              id="circlePath3"
              d="M 250, 250 m -120, 0 a 120,120 0 1,1 240,0 a 120,120 0 1,1 -240,0"
            />
          </defs>
          <text
            fontSize="30"
            fontWeight="500"
            fill="rgba(255, 255, 255, 0.5)"
            filter="url(#shadow)"
            style={{
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            <textPath href="#circlePath3" startOffset="0%">
              Loading • Loading • Loading • Loading • Loading •
            </textPath>
          </text>
        </svg>

        {/* Innermost Circle 4 */}
        <svg
          viewBox="0 0 500 500"
          className="w-[450px] h-[450px] absolute"
          style={{
            animation:
              "rotateReverse3D 6s linear infinite, divingScale4 4s ease-in-out 3s infinite",
            transformStyle: "preserve-3d",
          }}
        >
          <defs>
            <path
              id="circlePath4"
              d="M 250, 250 m -90, 0 a 90,90 0 1,1 180,0 a 90,90 0 1,1 -180,0"
            />
          </defs>
          <text
            fontSize="26"
            fontWeight="400"
            fill="rgba(255, 255, 255, 0.4)"
            filter="url(#shadow)"
            style={{
              fontFamily: "'Geist Mono', monospace",
            }}
          >
            <textPath href="#circlePath4" startOffset="0%">
              • • • • • • • • • • • • • • • • • •
            </textPath>
          </text>
        </svg>
      </div>

      <style jsx>{`
        @keyframes fadeOut {
          0% {
            opacity: 1;
            visibility: visible;
          }
          100% {
            opacity: 0;
            visibility: hidden;
          }
        }

        @keyframes rotateSVG3D {
          0% {
            transform: rotateZ(0deg) rotateY(0deg) translateZ(20px);
          }
          50% {
            transform: rotateZ(180deg) rotateY(10deg) translateZ(30px);
          }
          100% {
            transform: rotateZ(360deg) rotateY(0deg) translateZ(20px);
          }
        }

        @keyframes rotateReverse3D {
          0% {
            transform: rotateZ(0deg) rotateY(0deg) translateZ(10px);
          }
          50% {
            transform: rotateZ(-180deg) rotateY(-10deg) translateZ(20px);
          }
          100% {
            transform: rotateZ(-360deg) rotateY(0deg) translateZ(10px);
          }
        }

        @keyframes logoScale3D {
          0%,
          100% {
            transform: scale(1) translateZ(50px);
            opacity: 1;
          }
          50% {
            transform: scale(1.1) translateZ(60px);
            opacity: 0.8;
          }
        }

        @keyframes divingScale1 {
          0% {
            transform: scale(0.5);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
            opacity: 0.6;
          }
          100% {
            transform: scale(0.5);
            opacity: 0;
          }
        }

        @keyframes divingScale2 {
          0% {
            transform: scale(1.5);
            opacity: 0;
          }
          50% {
            transform: scale(1);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        @keyframes divingScale3 {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1);
            opacity: 0.5;
          }
          100% {
            transform: scale(0.3);
            opacity: 0;
          }
        }

        @keyframes divingScale4 {
          0% {
            transform: scale(1.8);
            opacity: 0;
          }
          50% {
            transform: scale(1);
            opacity: 0.4;
          }
          100% {
            transform: scale(1.8);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default CircularLoader;
