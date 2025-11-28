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

function buildShadowStyle(shadow: IconPositionConfig['shadow']): React.CSSProperties {
  if (!shadow.enabled) {
    return {};
  }
  return {
    filter: `drop-shadow(${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px rgba(0, 0, 0, ${shadow.opacity}))`,
  };
}

export const LocationIconsOverlay: React.FC<Props> = ({ settings }) => {
  const { speechBubble, location } = settings;

  return (
    <>
      {speechBubble.enabled && (
        <div
          className="location-icon-bubble"
          style={{
            ...buildWrapperStyle(speechBubble),
            ...buildShadowStyle(speechBubble.shadow),
            zIndex: 5,
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
