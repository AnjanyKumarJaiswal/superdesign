import { useEffect } from "react";
import "./RotatingCarousel.css";

const RotatingCarousel = ({ items = [] }) => {
  useEffect(() => {
    // Any initialization logic if needed
  }, []);

  const defaultItems = [
    "Creative Design",
    "UI/UX Excellence",
    "Web Development",
    "Brand Identity",
    "Digital Art",
    "Motion Graphics",
    "Product Design",
    "User Research",
  ];

  const displayItems = items.length > 0 ? items : defaultItems;

  return (
    <div className="rotating-carousel-container">
      <div className="carousel-scroller">
        {/* Buffer for initial view */}
        <div className="carousel-buffer"></div>

        {/* Snap points for scroll */}
        {displayItems.map((_, index) => (
          <div key={`snap-${index}`} className="carousel-snap"></div>
        ))}

        {/* Spinner wrapper */}
        <div className="carousel-spinner-wrap">
          <div className="carousel-spinner">
            <div className="carousel-item-wrap">
              {displayItems.map((item, index) => (
                <div key={index} className={`carousel-item carousel-item-${index + 1}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="carousel-dot"></div>
        </div>
      </div>
    </div>
  );
};

export default RotatingCarousel;
