// src/components/LocationIconsOverlay.tsx
import React from "react";
import { motion } from "framer-motion";
import type { LocationIconSettings, IconPositionConfig, AnimationConfig } from "../types/locationIcon";

import SpeechBubbleSvg from "../assets/SpeechBubble.svg";
import LocationSvg from "../assets/Location.svg";

interface Props {
  settings: LocationIconSettings;
}

function buildWrapperStyle(config: IconPositionConfig): React.CSSProperties {
  return {
    position: "absolute",
    left: `${config.xPercent}%`,
    top: `${config.yPercent}%`,
    transform: "translate(-50%, -50%)",
    transformOrigin: "center center",
    pointerEvents: "none",
  };
}

function buildImageStyle(config: IconPositionConfig): React.CSSProperties {
  return {
    width: `${config.size}px`,
    height: "auto",
    display: "block",
    transform: `rotate(${config.rotation}deg)`,
    transformOrigin: "center center",
  };
}

function buildShadowStyle(shadow: IconPositionConfig['shadow']): React.CSSProperties {
  if (!shadow.enabled) {
    return {};
  }
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.opacity}))`,
  };
}

function buildAnimationProps(animation?: AnimationConfig) {
  if (!animation || !animation.enabled || animation.type === "none") {
    return {};
  }

  const duration = animation.duration;
  const amplitude = animation.amplitude;

  switch (animation.type) {
    case "floating":
      return {
        animate: {
          y: [0, -amplitude, 0],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    case "pulse":
      return {
        animate: {
          scale: [1, 1.1, 1],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeInOut" as const,
        },
      };
    case "bounce":
      return {
        animate: {
          y: [0, -amplitude, 0],
        },
        transition: {
          duration,
          repeat: Infinity,
          ease: "easeOut" as const,
        },
      };
    default:
      return {};
  }
}

export const LocationIconsOverlay: React.FC<Props> = ({ settings }) => {
  const { speechBubble, location } = settings;

  // Create a key based on animation settings to force re-mount when settings change
  const animationKey = speechBubble.animation
    ? `${speechBubble.animation.enabled}-${speechBubble.animation.type}-${speechBubble.animation.duration}-${speechBubble.animation.amplitude}`
    : "no-animation";

  return (
    <>
      {speechBubble.enabled && (
        <motion.div
          key={animationKey}
          style={{
            ...buildWrapperStyle(speechBubble),
            ...buildShadowStyle(speechBubble.shadow),
            zIndex: 5,
          }}
          {...buildAnimationProps(speechBubble.animation)}
        >
          <img
            src={SpeechBubbleSvg}
            alt="Current location speech bubble"
            style={buildImageStyle(speechBubble)}
          />
        </motion.div>
      )}

      {location.enabled && (
        <div
          style={{
            ...buildWrapperStyle(location),
            ...buildShadowStyle(location.shadow),
            zIndex: 6,
          }}
        >
          <img
            src={LocationSvg}
            alt="Current location pin"
            style={buildImageStyle(location)}
          />
        </div>
      )}
    </>
  );
};
