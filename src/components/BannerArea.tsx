// src/components/BannerArea.tsx
import React, { useEffect, useRef, useState } from "react";
import type { BannerDisplayMode } from "../types/imageSettings";

interface BannerAreaProps {
  images: string[];
  /** Per-image visibility flags. Index matches images[]. Absent = visible. */
  imageEnabled?: boolean[];
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
  imageEnabled,
  displayMode,
  carouselIntervalMs,
  gap = 8,
  autoFit = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionEnabled, setTransitionEnabled] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visibleImages = images.filter((img, idx) => {
    if (!img || img.length === 0) return false;
    if (imageEnabled && idx < imageEnabled.length && !imageEnabled[idx]) return false;
    return true;
  });

  // Timer: advance slide by slide; stop at clone index (visibleImages.length)
  // and let onTransitionEnd handle the snap back to 0.
  useEffect(() => {
    if (displayMode !== "carousel" || visibleImages.length <= 1) return;

    const schedule = () => {
      timerRef.current = setTimeout(() => {
        setCurrentIndex((prev) => {
          // Don't advance past the clone at index n
          if (prev >= visibleImages.length) return prev;
          return prev + 1;
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
  // Carousel mode — horizontal slide with seamless loop
  //
  // Strip layout: [img0, img1, ..., imgN-1, img0(clone)]
  //   • Normal advance: 0 → 1 → … → N-1 → N(clone)  (slides left each time)
  //   • After sliding to clone (index N), onTransitionEnd snaps to index 0
  //     with no transition — visually seamless since clone == img0.
  // -------------------------------------------------------------------------
  const stripImages = visibleImages.length > 1
    ? [...visibleImages, visibleImages[0]]
    : visibleImages;

  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          transform: `translateX(-${currentIndex * 100}%)`,
          transition: transitionEnabled ? "transform 0.5s ease-in-out" : "none",
        }}
        onTransitionEnd={(e) => {
          if (e.propertyName !== "transform") return;
          // Snap back from clone to real index 0, invisibly
          if (currentIndex >= visibleImages.length) {
            setTransitionEnabled(false);
            setCurrentIndex(0);
            requestAnimationFrame(() =>
              requestAnimationFrame(() => setTransitionEnabled(true))
            );
          }
        }}
      >
        {stripImages.map((src, idx) => (
          <img
            key={idx}
            src={src}
            alt={`バナー ${(idx % visibleImages.length) + 1}`}
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
