import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import "./AnimatedWordSelector.css";

gsap.registerPlugin(ScrollToPlugin);

const AnimatedWordSelector = () => {
  const selectRef = useRef(null);
  const scrollerRef = useRef(null);
  const optionsRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const words = [
    "design",
    "prototype",
    "build",
    "develop",
    "create",
    "innovate",
    "visualize",
    "transform",
    "optimize",
    "collaborate",
    "inspire",
    "ship",
  ];

  const getScrollTopToCenterElement = (container, element) => {
    if (!container || !element) return 0;

    const style = getComputedStyle(container);
    const paddingTop = Number.parseFloat(style.paddingTop);
    const paddingBottom = Number.parseFloat(style.paddingBottom);

    const containerScrollTop = container.scrollTop;
    const containerTop = container.getBoundingClientRect().top;
    const elementTop = element.getBoundingClientRect().top;

    const offsetInsideContainer =
      elementTop - containerTop + containerScrollTop;

    const containerHeight = container.clientHeight;
    const elementHeight = element.offsetHeight;

    const scrollTarget =
      offsetInsideContainer -
      (containerHeight - paddingTop - paddingBottom) / 2 +
      elementHeight / 2 -
      paddingTop;

    return scrollTarget;
  };

  const assignProximityValues = (items, selectedIndex) => {
    items.forEach((item, index) => {
      const distance = Math.min(3, Math.abs(index - selectedIndex));
      item.style.setProperty("--proximity", distance);
    });
  };

  useEffect(() => {
    const options = optionsRef.current?.children;
    if (options) {
      assignProximityValues([...options], currentIndex);
    }
  }, [currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);

      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % words.length);
        setIsTransitioning(false);
      }, 600);
    }, 2000);

    return () => clearInterval(interval);
  }, [words.length]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const options = optionsRef.current?.children;

    if (!scroller || !options || !options[currentIndex]) return;

    const selected = options[currentIndex];
    const top = getScrollTopToCenterElement(scroller, selected);

    gsap.to(scroller, {
      scrollTo: top,
      duration: 0.8,
      ease: "power2.inOut",
    });
  }, [currentIndex]);

  return (
    <div className="word-selector-wrapper">
      <span className="word-selector-prefix">you</span>
      <div className="custom-select" ref={selectRef}>
        <div className="select-button">
          <span
            className="selected-content"
            key={currentIndex}
            style={{
              animation: isTransitioning
                ? "rollOutToTop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards"
                : "rollInFromBottom 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
          >
            {words[currentIndex]}
          </span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            stroke="currentColor"
            className="chevron-icon"
          >
            <path
              className="chevron-top"
              d="M7 9L12 4"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              className="chevron-top--left"
              d="M17 9L12 4"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              className="chevron-bottom"
              d="M7 15L12 20"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              className="chevron-bottom--right"
              d="M17 15L12 20"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="scroller" ref={scrollerRef}>
          <div className="options" ref={optionsRef}>
            {words.map((word, index) => (
              <div
                key={word}
                className={`option ${index === currentIndex ? "active" : ""}`}
                style={{ "--proximity": Math.abs(index - currentIndex) }}
              >
                {word}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnimatedWordSelector;
