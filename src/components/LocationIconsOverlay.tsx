// src/components/LocationIconsOverlay.tsx
import React from "react";
import type { LocationIconSettings, IconPositionConfig } from "../types/locationIcon";

import SpeechBubbleSvg from "../assets/SpeechBubble.svg";
import LocationSvg from "../assets/Location.svg";

interface Props {
  settings: LocationIconSettings;
}

function buildStyle(config: IconPositionConfig): React.CSSProperties {
  return {
    position: "absolute",
    left: `${config.xPercent}%`,
    top: `${config.yPercent}%`,
    width: `${config.size}px`,
    height: "auto",
    transform: `translate(-50%, -50%) rotate(${config.rotation}deg)`,
    transformOrigin: "center center",
    pointerEvents: "none",
  };
}

export const LocationIconsOverlay: React.FC<Props> = ({ settings }) => {
  const { speechBubble, location } = settings;

  return (
    <>
      {speechBubble.enabled && (
        <img
          src={SpeechBubbleSvg}
          alt="Current location speech bubble"
          style={{
            ...buildStyle(speechBubble),
            zIndex: 5,
            animation: "speech-bubble-floating 2.2s ease-in-out infinite",
          }}
        />
      )}

      {location.enabled && (
        <img
          src={LocationSvg}
          alt="Current location pin"
          style={{
            ...buildStyle(location),
            zIndex: 6,
          }}
        />
      )}
    </>
  );
};
