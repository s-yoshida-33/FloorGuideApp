// src/config/index.ts
import type { LocationIconSettings } from '../types/locationIcon';

// Global app configuration (do not use Japanese in comments to avoid encoding issues)
export const APP_CONFIG = {
  // Default base URL for BridgeWebPopper HTTP server
  defaultApiBaseUrl: "http://localhost:8090",

  // Default floor for this screen (this screen is dedicated to one floor)
  floor: "3F",

  // Layout configuration (4K display assumed)
  listHeightVh: (800 / 2160) * 100, // ≒ 37vh
  maxColumns: 3,
  minColumns: 2,
  approxRowsPerCol: 20,
  showGenreMemo: true,
  numberColWidthVmin: 6,
  fontSizeVmin: 1.05,
};

// Effective API base URL
// Priority: window.__BWP_BASE_URL__ (injected by BridgeWebPopper) > Electron API (port range detection) > Vite env > default
// Note: API_BASE_URL is now a function that returns a Promise to support async port detection
let cachedApiBaseUrl: string | null = null;

export async function getApiBaseUrl(): Promise<string> {
  // Priority 1: window.__BWP_BASE_URL__ (injected by BridgeWebPopper)
  if ((window as any).__BWP_BASE_URL__) {
    return (window as any).__BWP_BASE_URL__;
  }

  // Priority 2: Electron API (port range detection)
  if ((window as any).electronAPI?.getBridgeBaseUrl) {
    try {
      const url = await (window as any).electronAPI.getBridgeBaseUrl();
      if (url) {
        cachedApiBaseUrl = url;
        return url;
      }
    } catch (error) {
      console.warn('Failed to get Bridge base URL from Electron API', error);
    }
  }

  // Priority 3: Cached value (if available)
  if (cachedApiBaseUrl) {
    return cachedApiBaseUrl;
  }

  // Priority 4: Vite env
  if (import.meta.env.VITE_API_BASE) {
    const viteUrl = import.meta.env.VITE_API_BASE;
    cachedApiBaseUrl = viteUrl;
    return viteUrl;
  }

  // Priority 5: Default
  cachedApiBaseUrl = APP_CONFIG.defaultApiBaseUrl;
  return APP_CONFIG.defaultApiBaseUrl;
}

// For backward compatibility, export a synchronous getter that uses cached value or default
export const API_BASE_URL: string = APP_CONFIG.defaultApiBaseUrl;

// Data source switch (prepared for future extensions)
export type DataSource = "bridge" | "api" | "cms" | "hybrid";

export const DATA_SOURCE: DataSource =
  (import.meta.env.VITE_DATA_SOURCE as DataSource) ?? "bridge";

// Genre order used for floor guide sections (display order)
export const GENRE_ORDER: string[] = [
  "ファッション",
  "ファッション雑貨",
  "雑貨",
  "飲食店・食品",
  "サービス",
];

// Japanese -> English genre dictionary
export const GENRE_ENGLISH: Record<string, string> = {
  "ファッション": "Fashion",
  "ファッション雑貨": "Fashion Goods",
  "雑貨": "Goods",
  "飲食店・食品": "Food & Beverage",
  "サービス": "Services",
};

// Location icon settings (speech bubble and location icon)
export const DEFAULT_LOCATION_ICON_SETTINGS: LocationIconSettings = {
  speechBubble: {
    enabled: true,
    xPercent: 50,
    yPercent: 40,
    size: 96,
    rotation: 0,
    shadow: {
      enabled: true,
      offsetX: 4,
      offsetY: 4,
      blur: 4,
      opacity: 0.5,
    },
    animation: {
      enabled: true,
      type: "floating",
      duration: 2.2,
      amplitude: 18,
    },
  },
  location: {
    enabled: true,
    xPercent: 50,
    yPercent: 50,
    size: 72,
    rotation: 0,
    shadow: {
      enabled: true,
      offsetX: 4,
      offsetY: 4,
      blur: 4,
      opacity: 0.5,
    },
  },
};

export const FLOOR_COLUMN_COUNT: Record<string, number> = {
  "1F": 3,
  "2F": 2,
  "3F": 3,
  "4F": 2,
};

export const FLOOR_ROWS_PER_COL: Record<string, number> = {
  "1F": 20,
  "2F": 19,
  "3F": 20,
  "4F": 18,
};

// Timeline stream SSE endpoint
export const TIMELINE_STREAM_URL =
  import.meta.env.VITE_TIMELINE_STREAM_URL ?? "http://localhost:48080/api/timeline/stream";

// Polling intervals
export const POLLING_INTERVALS = {
  IMAGE_CHECK_MS: 5 * 60 * 1000, // 5 minutes
};