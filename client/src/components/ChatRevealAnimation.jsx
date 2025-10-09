import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import "./ChatRevealAnimation.css";

const ChatRevealAnimation = ({ onComplete, duration = 4000 }) => {
  const svgRef = useRef(null);
  const wrapperRef = useRef(null);
  const cursorRef = useRef(null);
  const wordRef = useRef(null);
  const [particles, setParticles] = useState([]);
  const particlesRef = useRef([]);
  const mouseRef = useRef({
    x: 0,
    y: 0,
    smoothX: 0,
    smoothY: 0,
    diff: 0,
  });

  useEffect(() => {
    const mouse = mouseRef.current;
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    // Auto-animate mouse in circular pattern
    let angle = 0;
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const radius = Math.min(viewport.width, viewport.height) / 3;

    const animateMouse = () => {
      angle += 0.02;
      mouse.x = centerX + Math.cos(angle) * radius;
      mouse.y = centerY + Math.sin(angle) * radius;
    };

    const handleResize = () => {
      viewport.width = window.innerWidth;
      viewport.height = window.innerHeight;

      if (svgRef.current) {
        svgRef.current.style.width = viewport.width + "px";
        svgRef.current.style.height = viewport.height + "px";
      }

      if (wordRef.current) {
        const maxScale = viewport.height / (wordRef.current.clientHeight * 0.75);
        wordRef.current.style.setProperty("--max-scale", maxScale);
      }
    };

    const emitParticle = () => {
      let x = 0;
      let y = 0;
      let size = 0;

      if (mouse.diff > 0.01) {
        x = mouse.smoothX;
        y = mouse.smoothY;
        size = Math.min(mouse.diff * 0.2, 50);
      }

      const particle = {
        id: Date.now() + Math.random(),
        x,
        y,
        size,
        seed: Math.random() * 1000,
        freq: (0.5 + Math.random() * 1) * 0.01,
        amplitude: (1 - Math.random() * 2) * 0.5,
        color: "#fff",
        scale: size,
      };

      particlesRef.current.push(particle);

      // Animate particle
      const tl = gsap.timeline();
      tl.to(particle, {
        scale: size * 2,
        ease: "power1.inOut",
        duration: 2,
      });

      tl.to(
        particle,
        {
          scale: 0,
          ease: "power4.in",
          duration: 4,
          onComplete: () => {
            particlesRef.current = particlesRef.current.filter(
              (p) => p.id !== particle.id
            );
          },
        },
        3
      );
    };

    const render = () => {
      animateMouse();

      // Smooth mouse
      mouse.smoothX += (mouse.x - mouse.smoothX) * 0.1;
      mouse.smoothY += (mouse.y - mouse.smoothY) * 0.1;

      mouse.diff = Math.hypot(mouse.x - mouse.smoothX, mouse.y - mouse.smoothY);

      emitParticle();

      // Update cursor
      if (cursorRef.current) {
        cursorRef.current.style.setProperty("--x", mouse.smoothX + "px");
        cursorRef.current.style.setProperty("--y", mouse.smoothY + "px");
      }

      // Trigger re-render
      setParticles([...particlesRef.current]);

      if (particlesRef.current.length > 0) {
        requestAnimationFrame(render);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    const renderLoop = requestAnimationFrame(render);

    // Auto complete after duration
    const timer = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(renderLoop);
      clearTimeout(timer);
    };
  }, [duration, onComplete]);

  return (
    <div className="chat-reveal-container">
      <div className="s-hero">
        <h1 className="s__title">
          Superdesign AI
          <br />
          Design Assistant
          <br />
          Ready to Create
        </h1>

        <div className="s__catcher">Loading Canvas</div>

        <div className="s__burger">
          <div className="s__burger__line"></div>
          <div className="s__burger__line"></div>
          <div className="s__burger__line"></div>
        </div>
      </div>

      <div className="s-scene">
        <div className="s__title">
          <div className="s__title__line">Let's Create</div>
          <div className="s__title__line">Something</div>
        </div>

        <div className="s__word js-word" ref={wordRef}>
          <div className="s__word__char">M</div>
          <div className="s__word__char">A</div>
          <div className="s__word__char">D</div>
        </div>
      </div>

      <div className="cursor js-cursor" ref={cursorRef}></div>

      <svg
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        width="100"
        height="100"
        className="s-svg js-svg"
        ref={svgRef}
      >
        <mask id="mask">
          <g className="js-wrapper" filter="url(#gooey)" ref={wrapperRef}>
            {particles.map((particle) => (
              <circle
                key={particle.id}
                cx={particle.x}
                cy={particle.y}
                r={particle.scale}
                fill={particle.color}
              />
            ))}
          </g>
        </mask>
        <filter id="gooey">
          <feGaussianBlur in="SourceGraphic" stdDeviation="25" />
          <feColorMatrix
            type="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 30 -7"
            result="goo"
          />
        </filter>
      </svg>
    </div>
  );
};

export default ChatRevealAnimation;
