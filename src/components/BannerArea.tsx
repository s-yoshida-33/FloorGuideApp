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
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleImages = images.filter((img) => img && img.length > 0);

  useEffect(() => {
    if (displayMode !== "carousel" || visibleImages.length <= 1) return;

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          setCurrentIndex((prev) => (prev + 1) % visibleImages.length);
          setVisible(true);
          schedule();
        }, 400);
      }, carouselIntervalMs);
    };

    schedule();

    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [displayMode, visibleImages.length, carouselIntervalMs]);

  useEffect(() => {
    setCurrentIndex(0);
    setVisible(true);
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
  // Carousel mode
  // -------------------------------------------------------------------------
  const safeCurrent = currentIndex % visibleImages.length;

  return (
    <div style={{ width: "100%", position: "relative" }}>
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
