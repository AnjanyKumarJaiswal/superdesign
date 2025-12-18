import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import CircularLoader from "./Loading/CircularLoader";
import RollingText from "./Loading/RollingText";
import RotatingCarousel from "./RotatingCarousel/RotatingCarousel";
import ArrowLoader from "./Loading/ArrowLoader";
import TokenManagerAdmin from "./TokenManagerAdmin";
import CacheCleaner from "./CacheCleaner";

const HomePage = () => {
  const [loading, setLoading] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [showCacheCleaner, setShowCacheCleaner] = useState(false);
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const animationFrameRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      setTimeout(() => {
        setShowContent(true);
      }, 100);
    }
  }, [loading]);

  useEffect(() => {
    if (!canvasRef.current || loading) return;

    let scene,
      camera,
      renderer,
      composer,
      particles,
      energyLines = [];
    const mouse = new THREE.Vector2(10000, 10000);
    let particleData = [];
    const clock = new THREE.Clock();

    const init = () => {
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
      camera.position.set(0, 0, 50);

      renderer = new THREE.WebGLRenderer({
        canvas: canvasRef.current,
        antialias: true,
        alpha: true,
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.0,
        0.8,
        0.1,
      );
      composer.addPass(bloomPass);

      createMainParticles();
      createEnergyLines();

      sceneRef.current = {
        scene,
        camera,
        renderer,
        composer,
        particles,
        energyLines,
        particleData,
      };
    };

    const createMainParticles = () => {
      const particleCount = 15000;
      const positions = new Float32Array(particleCount * 3);
      const colors = new Float32Array(particleCount * 3);
      const baseColor = new THREE.Color(0x000000);

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const x = (Math.random() - 0.5) * 120;
        const y = (Math.random() - 0.5) * 120;

        particleData.push({
          originalPos: new THREE.Vector3(x, y, (Math.random() - 0.5) * 20),
          currentPos: new THREE.Vector3(x, y, (Math.random() - 0.5) * 20),
          velocity: new THREE.Vector3(),
        });

        positions[i3] = x;
        positions[i3 + 1] = y;
        positions[i3 + 2] = particleData[i].originalPos.z;

        baseColor.toArray(colors, i3);
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const material = new THREE.PointsMaterial({
        size: 1.5,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });

      particles = new THREE.Points(geometry, material);
      scene.add(particles);
    };

    const createEnergyLines = () => {
      const lineCount = 30;
      for (let i = 0; i < lineCount; i++) {
        const geometry = new LineGeometry();
        const points = [];
        const z = (Math.random() - 0.5) * 150 - 75;
        const startX = (Math.random() - 0.5) * 150;
        const startY = (Math.random() - 0.5) * 150;
        const length = Math.random() * 10 + 5;

        points.push(startX, startY, z);
        points.push(startX, startY - length, z);
        geometry.setPositions(points);

        const material = new LineMaterial({
          color: 0x88aaff,
          linewidth: 0.003,
          transparent: true,
          opacity: 0.5,
          dashed: false,
        });
        material.resolution.set(window.innerWidth, window.innerHeight);

        const line = new Line2(geometry, material);
        line.userData.speed = Math.random() * 30 + 15;
        line.userData.originalZ = z;

        energyLines.push(line);
        scene.add(line);
      }
    };

    const onWindowResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height);
      composer.setSize(width, height);

      energyLines.forEach((line) => {
        line.material.resolution.set(width, height);
      });
    };

    const onMouseMove = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    const animate = () => {
      const delta = clock.getDelta();
      const elapsedTime = clock.getElapsedTime();
      animationFrameRef.current = requestAnimationFrame(animate);

      const mousePos3D = new THREE.Vector3(mouse.x, mouse.y, 0.5);
      mousePos3D.unproject(camera);
      const dir = mousePos3D.sub(camera.position).normalize();
      const distance = -camera.position.z / dir.z;
      const finalMousePos = camera.position
        .clone()
        .add(dir.multiplyScalar(distance));

      const positions = particles.geometry.attributes.position.array;
      const colors = particles.geometry.attributes.color.array;
      const highlightColor = new THREE.Color(0xffffff);

      for (let i = 0; i < particleData.length; i++) {
        const i3 = i * 3;
        const data = particleData[i];

        const diff = new THREE.Vector3().subVectors(
          data.currentPos,
          finalMousePos,
        );
        const dist = diff.length();
        let force = 0;
        if (dist < 20) {
          force = (1 - dist / 20) * 0.1;
          diff.normalize();
          data.velocity.add(diff.multiplyScalar(force));
        }

        const springForce = new THREE.Vector3()
          .subVectors(data.originalPos, data.currentPos)
          .multiplyScalar(0.01);
        data.velocity.add(springForce);
        data.velocity.multiplyScalar(0.92);

        data.currentPos.add(data.velocity);

        positions[i3] = data.currentPos.x;
        positions[i3 + 1] = data.currentPos.y;
        positions[i3 + 2] =
          data.currentPos.z +
          Math.sin(data.originalPos.x * 0.1 + elapsedTime) * 5.0;

        let colorMix = dist < 20 ? 1 - dist / 20 : 0;
        const color = new THREE.Color(0x000000).lerp(highlightColor, colorMix);
        color.toArray(colors, i3);
      }
      particles.geometry.attributes.position.needsUpdate = true;
      particles.geometry.attributes.color.needsUpdate = true;

      energyLines.forEach((line) => {
        line.position.z = line.position.z + line.userData.speed * delta;
        if (line.position.z > 50) {
          line.position.z = -150;
        }
      });

      composer.render();
    };

    init();
    animate();

    window.addEventListener("resize", onWindowResize);
    window.addEventListener("mousemove", onMouseMove);

    return () => {
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("mousemove", onMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (renderer) {
        renderer.dispose();
      }
      if (composer) {
        composer.dispose();
      }
    };
  }, [loading]);

  const handleGetStarted = (e) => {
    e.preventDefault();
    setTransitioning(true);
  };

  const handleTransitionComplete = () => {
    navigate("/prompt");
  };

  return (
    <>
      {loading && <CircularLoader onLoadComplete={() => setLoading(false)} />}

      {transitioning && (
        <ArrowLoader duration={2000} onComplete={handleTransitionComplete} />
      )}

      <div
        className="min-h-screen relative"
        style={{
          backgroundColor: "#030014",
          fontFamily: "'Geist Mono', monospace",
          overflow: "hidden",
        }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 z-0"
          style={{ width: "100%", height: "100%" }}
        />

        {!loading && <RotatingCarousel />}

        <div className="relative z-10 min-h-screen flex flex-col">
          <nav className="px-6 py-4 md:px-12 md:py-6 backdrop-blur-md bg-black/30">
            <div className="flex justify-between items-center max-w-7xl mx-auto">
              <div className="flex items-center space-x-3">
                <img
                  src="/logo/Logo.png"
                  alt="SuperDesign"
                  className="h-8 w-8"
                />
                <span className="text-white font-semibold text-xl tracking-tight">
                  SuperDesign
                </span>
              </div>
              <div className="hidden md:flex space-x-10 text-white/90 text-sm font-medium">
                <a
                  href="#"
                  className="hover:text-white transition-colors duration-200"
                >
                  About
                </a>
                <a
                  href="#"
                  className="hover:text-white transition-colors duration-200"
                >
                  Features
                </a>
                <Link
                  to="/chat"
                  className="hover:text-white transition-colors duration-200"
                >
                  Chat
                </Link>
              </div>
              <div className="md:hidden">
                <button className="text-white">
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </nav>

          <div className="flex-1 flex items-center justify-center px-6 md:px-12">
            <div className="text-center max-w-4xl mx-auto">
              {showContent && (
                <>
                  <div
                    className="font-black text-white mb-8 tracking-tighter transition-all duration-300"
                    style={{
                      fontSize: "clamp(3rem, 15vw, 12rem)",
                      textShadow:
                        "0 0 20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 0, 0, 0.6)",
                      animation: "reverseFadeIn 2s ease-out forwards",
                      opacity: 0,
                      lineHeight: "1em",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.textShadow =
                        "0 0 20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 0, 0, 0.6), -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, -3px 0 0 #000, 3px 0 0 #000, 0 -3px 0 #000, 0 3px 0 #000";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.textShadow =
                        "0 0 20px rgba(0, 0, 0, 0.8), 0 0 40px rgba(0, 0, 0, 0.6)";
                    }}
                  >
                    <RollingText text="Design beyond reality" delay={100} />
                  </div>

                  <div
                    className="text-lg md:text-xl text-gray-300 mb-6 leading-relaxed max-w-2xl mx-auto"
                    style={{
                      animation: "reverseFadeIn 2.3s ease-out 0.3s forwards",
                      opacity: 0,
                    }}
                  >
                    <RollingText
                      text="Where imagination meets precision in every pixel"
                      delay={400}
                    />
                  </div>

                  <div
                    className="mt-10 flex items-center justify-center mb-16"
                    style={{
                      animation: "reverseFadeIn 2.6s ease-out 0.6s forwards",
                      opacity: 0,
                    }}
                  >
                    <a
                      href="#"
                      onClick={handleGetStarted}
                      className="shimmer-button"
                    >
                      <span className="spark__container">
                        <span className="spark"></span>
                      </span>
                      <span className="backdrop"></span>
                      <span className="text">Get Started</span>
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="pb-8 pt-4">
            <div className="flex justify-center space-x-8 mb-6">
              <a
                href="#"
                className="text-white/60 hover:text-white/80 transition-colors duration-200"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-white/60 hover:text-white/80 transition-colors duration-200"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="#"
                className="text-white/60 hover:text-white/80 transition-colors duration-200"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
                </svg>
              </a>
            </div>

            {showContent && (
              <div className="mx-auto text-center mb-4 flex justify-center gap-4"
                style={{
                  animation: "reverseFadeIn 3s ease-out 1s forwards",
                  opacity: 0,
                }}
              >
                <button
                  onClick={() => {
                    setShowAdminPanel(prev => !prev);
                    if (showCacheCleaner) setShowCacheCleaner(false);
                  }}
                  className={`text-white/40 hover:text-white/70 transition-all duration-300 text-xs font-light py-1 px-3 rounded-full border border-white/10 bg-black/20 backdrop-blur-sm ${showAdminPanel ? 'bg-black/40' : ''}`}
                >
                  {showAdminPanel ? "Hide Admin Panel" : "Show Admin Panel"}
                </button>

                <button
                  onClick={() => {
                    setShowCacheCleaner(prev => !prev);
                    if (showAdminPanel) setShowAdminPanel(false);
                  }}
                  className={`text-white/40 hover:text-white/70 transition-all duration-300 text-xs font-light py-1 px-3 rounded-full border border-white/10 bg-black/20 backdrop-blur-sm ${showCacheCleaner ? 'bg-black/40 text-red-300' : ''}`}
                >
                  {showCacheCleaner ? "Hide Cache Cleaner" : "Clear OAuth Cache"}
                </button>
              </div>
            )}

            {showContent && showAdminPanel && (
              <div className="mx-auto max-w-md mb-8 transition-all duration-500 opacity-90 hover:opacity-100"
                style={{
                  animation: "fadeSlideIn 0.5s ease-out forwards",
                }}
              >
                <div className="admin-panel-wrapper backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg p-4">
                  <h3 className="text-white text-center mb-4 text-lg font-medium">Admin Controls</h3>
                  <TokenManagerAdmin />
                </div>
              </div>
            )}

            {showContent && showCacheCleaner && (
              <div className="mx-auto max-w-md mb-8 transition-all duration-500 opacity-90 hover:opacity-100"
                style={{
                  animation: "fadeSlideIn 0.5s ease-out forwards",
                }}
              >
                <div className="admin-panel-wrapper backdrop-blur-sm bg-black/20 border border-white/10 rounded-lg p-4">
                  <h3 className="text-white text-center mb-4 text-lg font-medium">Cache Cleaner</h3>
                  <CacheCleaner />
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-white/50 text-xs font-medium">
                © 2024 SuperDesign. Designed in California.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @import url("https://api.fontshare.com/v2/css?f[]=geist-mono@400,500,600,700&display=swap");

        body {
          overflow: hidden;
        }

        ::-webkit-scrollbar {
          display: none;
        }

        * {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes reverseFadeIn {
          0% {
            opacity: 0;
            transform: translateY(-30px) scale(1.1);
            filter: blur(10px);
          }
          50% {
            opacity: 0.5;
            filter: blur(5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }
        
        @keyframes fadeSlideIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .shimmer-button {
          --cut: 0.1em;
          --active: 0;
          --bg:
            radial-gradient(
              40% 50% at center 100%,
              hsl(270 0% 72% / 0.05),
              transparent
            ),
            radial-gradient(
              80% 100% at center 120%,
              hsl(260 0% 70% / 0.1),
              transparent
            ),
            hsl(260 0% 12%);
          background: var(--bg);
          font-size: 1.2rem;
          font-weight: 600;
          border: 0;
          cursor: pointer;
          padding: 0.9em 1.3em;
          display: grid;
          place-items: center;
          white-space: nowrap;
          border-radius: 100px;
          position: relative;
          overflow: hidden;
          box-shadow:
            0 0.05em 0 0 hsl(260 0% 50%) inset,
            0 -0.05em 0 0 hsl(260 0% 0%) inset;
          transition:
            box-shadow 0.25s,
            scale 0.25s,
            background 0.25s;
          scale: calc(1 + (var(--active) * 0.1));
          text-decoration: none;
        }

        .shimmer-button:active {
          scale: 1;
        }

        .shimmer-button:hover {
          --active: 1;
        }

        .spark {
          position: absolute;
          inset: 0;
          border-radius: 100px;
          rotate: 0deg;
          overflow: hidden;
          mask: linear-gradient(white, transparent 50%);
          animation: flip calc(1.8s * 2) infinite steps(2, end);
        }

        @keyframes flip {
          to {
            rotate: 360deg;
          }
        }

        .spark:before {
          content: "";
          position: absolute;
          width: 200%;
          aspect-ratio: 1;
          inset: 0 auto auto 50%;
          z-index: -1;
          translate: -50% -15%;
          rotate: 0;
          transform: rotate(-90deg);
          opacity: calc((var(--active)) + 0.4);
          background: conic-gradient(
            from 0deg,
            transparent 0 340deg,
            white 360deg
          );
          transition: opacity 0.25s;
          animation: rotate 1.8s linear infinite both;
        }

        .spark:after {
          content: "";
          position: absolute;
          inset: var(--cut);
          border-radius: 100px;
        }

        .backdrop {
          position: absolute;
          inset: var(--cut);
          background: var(--bg);
          border-radius: 100px;
          transition:
            background 0.25s,
            opacity 0.25s;
        }

        @keyframes rotate {
          to {
            transform: rotate(90deg);
          }
        }

        .shimmer-button .text {
          translate: 2% -6%;
          letter-spacing: 0.01ch;
          background: linear-gradient(
            90deg,
            hsl(0 0% calc((var(--active) * 100%) + 65%)),
            hsl(0 0% calc((var(--active) * 100%) + 26%))
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          transition: background 0.25s;
        }

        .spark__container {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
      `}</style>
    </>
  );
};

export default HomePage;
