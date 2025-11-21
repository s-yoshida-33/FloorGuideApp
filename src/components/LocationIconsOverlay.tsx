// src/components/LocationIconsOverlay.tsx
import React from "react";
import type { LocationIconSettings, IconPositionConfig } from "../types/locationIcon";

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

export const LocationIconsOverlay: React.FC<Props> = ({ settings }) => {
  const { speechBubble, location } = settings;

  return (
    <>
      {speechBubble.enabled && (
        <div
          className="location-icon-shadow"
          style={{
            ...buildWrapperStyle(speechBubble),
            zIndex: 5,
            animation: "speech-bubble-floating 2.2s ease-in-out infinite",
          }}
        >
          <img
            src={SpeechBubbleSvg}
            alt="Current location speech bubble"
            style={buildImageStyle(speechBubble)}
          />
        </div>
      )}

      {location.enabled && (
        <div
          className="location-icon-shadow"
          style={{
            ...buildWrapperStyle(location),
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
