import { useEffect, useRef } from "react";

const RollingText = ({ text, className = "", delay = 0 }) => {
  const elementRef = useRef(null);

  useEffect(() => {
    if (!elementRef.current) return;

    const element = elementRef.current;
    const innerText = text;
    element.innerHTML = "";

    // Split text into words
    const words = innerText.split(" ");

    words.forEach((word, wordIndex) => {
      const wordWrapper = document.createElement("span");
      wordWrapper.style.display = "inline-block";
      wordWrapper.style.marginRight = "0.5em";
      wordWrapper.style.overflow = "hidden";
      wordWrapper.style.height = "1em";
      wordWrapper.style.lineHeight = "1em";
      wordWrapper.style.verticalAlign = "top";

      const textContainer = document.createElement("span");
      textContainer.classList.add("block");
      textContainer.style.display = "block";

      for (let letter of word) {
        const span = document.createElement("span");
        span.innerText = letter;
        span.classList.add("letter");
        textContainer.appendChild(span);
      }

      wordWrapper.appendChild(textContainer);
      wordWrapper.appendChild(textContainer.cloneNode(true));
      element.appendChild(wordWrapper);

      // Add space after each word except the last one
      if (wordIndex < words.length - 1) {
        const space = document.createTextNode(" ");
        element.appendChild(space);
      }
    });

    // Auto-play animation after delay
    const timer = setTimeout(() => {
      element.classList.add("play");
    }, delay);

    return () => clearTimeout(timer);
  }, [text, delay]);

  return (
    <>
      <span
        ref={elementRef}
        className={`rolling-text ${className}`}
        onMouseEnter={(e) => {
          e.currentTarget.classList.remove("play");
        }}
      >
        {text}
      </span>

      <style jsx>{`
        .rolling-text {
          display: inline-block;
          font-family: "Geist Mono", monospace;
          overflow: visible;
          color: white;
        }

        .rolling-text.play .letter {
          transform: translateY(-100%);
        }

        .rolling-text .block {
          display: block;
        }

        .rolling-text .block:last-child {
          color: rgba(255, 255, 255, 0.7);
        }

        .rolling-text .letter {
          display: inline-block;
          transition: transform 0.6s cubic-bezier(0.76, 0, 0.24, 1);
        }

        .rolling-text .letter:nth-child(1) {
          transition-delay: 0s;
        }
        .rolling-text .letter:nth-child(2) {
          transition-delay: 0.008s;
        }
        .rolling-text .letter:nth-child(3) {
          transition-delay: 0.016s;
        }
        .rolling-text .letter:nth-child(4) {
          transition-delay: 0.024s;
        }
        .rolling-text .letter:nth-child(5) {
          transition-delay: 0.032s;
        }
        .rolling-text .letter:nth-child(6) {
          transition-delay: 0.04s;
        }
        .rolling-text .letter:nth-child(7) {
          transition-delay: 0.048s;
        }
        .rolling-text .letter:nth-child(8) {
          transition-delay: 0.056s;
        }
        .rolling-text .letter:nth-child(9) {
          transition-delay: 0.064s;
        }
        .rolling-text .letter:nth-child(10) {
          transition-delay: 0.072s;
        }
        .rolling-text .letter:nth-child(11) {
          transition-delay: 0.08s;
        }
        .rolling-text .letter:nth-child(12) {
          transition-delay: 0.088s;
        }
        .rolling-text .letter:nth-child(13) {
          transition-delay: 0.096s;
        }
        .rolling-text .letter:nth-child(14) {
          transition-delay: 0.104s;
        }
        .rolling-text .letter:nth-child(15) {
          transition-delay: 0.112s;
        }
        .rolling-text .letter:nth-child(16) {
          transition-delay: 0.12s;
        }
        .rolling-text .letter:nth-child(17) {
          transition-delay: 0.128s;
        }
        .rolling-text .letter:nth-child(18) {
          transition-delay: 0.136s;
        }
        .rolling-text .letter:nth-child(19) {
          transition-delay: 0.144s;
        }
        .rolling-text .letter:nth-child(20) {
          transition-delay: 0.152s;
        }
        .rolling-text .letter:nth-child(21) {
          transition-delay: 0.16s;
        }
        .rolling-text .letter:nth-child(22) {
          transition-delay: 0.168s;
        }
        .rolling-text .letter:nth-child(23) {
          transition-delay: 0.176s;
        }
        .rolling-text .letter:nth-child(24) {
          transition-delay: 0.184s;
        }
        .rolling-text .letter:nth-child(25) {
          transition-delay: 0.192s;
        }
        .rolling-text .letter:nth-child(26) {
          transition-delay: 0.2s;
        }
        .rolling-text .letter:nth-child(27) {
          transition-delay: 0.208s;
        }
        .rolling-text .letter:nth-child(28) {
          transition-delay: 0.216s;
        }
        .rolling-text .letter:nth-child(29) {
          transition-delay: 0.224s;
        }
        .rolling-text .letter:nth-child(30) {
          transition-delay: 0.232s;
        }
      `}</style>
    </>
  );
};

export default RollingText;
