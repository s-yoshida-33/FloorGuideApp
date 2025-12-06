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

// "blink" を追加
export type AnimationType = "floating" | "pulse" | "bounce" | "blink" | "none";

export interface AnimationConfig {
  enabled: boolean;
  // Animation type
  type: AnimationType;
  // Animation duration in seconds
  duration: number;
  // Animation amplitude (movement distance in px, for floating)
  amplitude: number;
  // Ripple color for blink animation (RGB/HEX, default: "#FFFFFF")
  rippleColor?: string;
  // Ripple size multiplier for blink animation (default: 1.5)
  rippleSize?: number;
  // Ripple center size (initial scale, default: 0.95)
  rippleCenterSize?: number;
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
    // Animation configuration
    animation?: AnimationConfig;
  }
  
  export interface LocationIconSettings {
    speechBubble: IconPositionConfig;
    location: IconPositionConfig;
  }