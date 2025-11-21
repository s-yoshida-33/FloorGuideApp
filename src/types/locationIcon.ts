// src/types/locationIcon.ts

export interface IconPositionConfig {
    enabled: boolean;
    // 0-100: relative position inside the map container
    xPercent: number;
    yPercent: number;
    // icon size in px (width), height keeps aspect ratio
    size: number;
    // rotation in degrees (0-360)
    rotation: number;
  }
  
  export interface LocationIconSettings {
    speechBubble: IconPositionConfig;
    location: IconPositionConfig;
  }
  