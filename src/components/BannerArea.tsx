// src/components/BannerArea.tsx
import React, { useEffect, useRef, useState } from "react";
import type { BannerDisplayMode } from "../types/imageSettings";

interface BannerAreaProps {
  images: string[];
  displayMode: BannerDisplayMode;
  carouselIntervalMs: number;
}

const BannerArea: React.FC<BannerAreaProps> = ({
  images,
  displayMode,
  carouselIntervalMs,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleImages = images.filter((img) => img && img.length > 0);

  useEffect(() => {
    if (displayMode !== "carousel" || visibleImages.length <= 1) return;

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        // Fade out
        setVisible(false);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % visibleImages.length);
          setVisible(true);
          schedule();
        }, 400); // fade transition duration
      }, carouselIntervalMs);
    };

    schedule();

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, [displayMode, visibleImages.length, carouselIntervalMs]);

  // Reset index if images change
  useEffect(() => {
    setCurrentIndex(0);
    setVisible(true);
  }, [visibleImages.length]);

  if (visibleImages.length === 0) return null;

  if (displayMode === "stack") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          width: "100%",
        }}
      >
        {visibleImages.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`バナー ${idx + 1}`}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        ))}
      </div>
    );
  }

  // carousel mode
  const safeCurrent = currentIndex % visibleImages.length;

  return (
    <div
      style={{
        width: "100%",
        position: "relative",
      }}
    >
      <img
        src={visibleImages[safeCurrent]}
        alt={`バナー ${safeCurrent + 1}`}
        style={{
          width: "100%",
          height: "auto",
          display: "block",
          objectFit: "contain",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.4s ease-in-out",
        }}
      />
    </div>
  );
};

export default BannerArea;
