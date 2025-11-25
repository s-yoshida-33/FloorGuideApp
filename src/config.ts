// src/config.ts
import type { LocationIconSettings } from './types/locationIcon';

// Global app configuration (do not use Japanese in comments to avoid encoding issues)
export const APP_CONFIG = {
  // Default base URL for BridgeWebPopper HTTP server
  defaultApiBaseUrl: "http://localhost:8080",

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
// Priority: window.__BWP_BASE_URL__ (injected by BridgeWebPopper) > Vite env > default
export const API_BASE_URL: string =
  (window as any).__BWP_BASE_URL__ ??
  import.meta.env.VITE_API_BASE ??
  APP_CONFIG.defaultApiBaseUrl;

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

// Japanese → English genre dictionary
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
  },
  location: {
    enabled: true,
    xPercent: 50,
    yPercent: 50,
    size: 72,
    rotation: 0,
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
