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
  }
  
  export interface LocationIconSettings {
    speechBubble: IconPositionConfig;
    location: IconPositionConfig;
  }
  