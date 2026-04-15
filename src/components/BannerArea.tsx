// src/components/BannerArea.tsx
import React, { useEffect, useRef, useState } from "react";
import type { BannerDisplayMode } from "../types/imageSettings";

interface BannerAreaProps {
  images: string[];
  displayMode: BannerDisplayMode;
  carouselIntervalMs: number;
  /** Gap between images in px (stack mode). Default: 8 */
  gap?: number;
  /**
   * Stack mode only: fill the parent's remaining height, distributing it
   * equally among all images. Each image scales to fit its share while
   * maintaining its aspect ratio (object-fit: contain).
   */
  autoFit?: boolean;
}

const BannerArea: React.FC<BannerAreaProps> = ({
  images,
  displayMode,
  carouselIntervalMs,
  gap = 8,
  autoFit = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleImages = images.filter((img) => img && img.length > 0);

  useEffect(() => {
    if (displayMode !== "carousel" || visibleImages.length <= 1) return;

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setCurrentIndex((prev) => {
          const next = (prev + 1) % visibleImages.length;
          if (next === 0) {
            // Looping back to first: snap instantly (no backward slide)
            setTransitionEnabled(false);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setTransitionEnabled(true))
            );
          }
          return next;
        });
        schedule();
      }, carouselIntervalMs);
    };

    schedule();

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [displayMode, visibleImages.length, carouselIntervalMs]);

  useEffect(() => {
    setCurrentIndex(0);
    setTransitionEnabled(true);
  }, [visibleImages.length]);

  if (visibleImages.length === 0) return null;

  // -------------------------------------------------------------------------
  // Stack mode — autoFit: fill parent height, each image gets equal share
  // -------------------------------------------------------------------------
  if (displayMode === "stack" && autoFit) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${gap}px`,
          height: "100%",
          width: "100%",
        }}
      >
        {visibleImages.map((src, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={src}
              alt={`バナー ${idx + 1}`}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Stack mode — normal: natural image size, configurable gap
  // -------------------------------------------------------------------------
  if (displayMode === "stack") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: `${gap}px`,
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

  // -------------------------------------------------------------------------
  // Carousel mode — horizontal slide
  // -------------------------------------------------------------------------
  const safeCurrent = currentIndex % visibleImages.length;

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          transform: `translateX(-${safeCurrent * 100}%)`,
          transition: transitionEnabled ? "transform 0.5s ease-in-out" : "none",
        }}
      >
        {visibleImages.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`バナー ${idx + 1}`}
            style={{
              width: "100%",
              flexShrink: 0,
              height: "auto",
              display: "block",
              objectFit: "contain",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default BannerArea;
