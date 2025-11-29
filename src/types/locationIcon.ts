// src/types/locationIcon.ts

export interface ShadowConfig {
  enabled: boolean;
  // Shadow offset in px
  offsetX: number;
  offsetY: number;
  // Shadow blur radius in px
  blur: number;
  // Shadow opacity (0-1)
  opacity: number;
}

export type AnimationType = "floating" | "pulse" | "bounce" | "none";

export interface AnimationConfig {
  enabled: boolean;
  // Animation type
  type: AnimationType;
  // Animation duration in seconds
  duration: number;
  // Animation amplitude (movement distance in px, for floating)
  amplitude: number;
}

export interface IconPositionConfig {
    enabled: boolean;
    // 0-100: relative position inside the map container
    xPercent: number;
    yPercent: number;
    // icon size in px (width), height keeps aspect ratio
    size: number;
    // rotation in degrees (0-360)
    rotation: number;
    // Shadow configuration
    shadow: ShadowConfig;
    // Animation configuration (only for speech bubble)
    animation?: AnimationConfig;
  }
  
  export interface LocationIconSettings {
    speechBubble: IconPositionConfig;
    location: IconPositionConfig;
  }
  