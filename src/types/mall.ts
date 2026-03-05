// src/types/mall.ts
import type { FloorId, FloorLayout } from './floorLayout';

/**
 * Supported mall identifiers.
 * Each ID maps to a unique layout, asset set, and per-mall settings file.
 */
export type MallId = "sakaikitahanada" | "suzaka";

/**
 * Static configuration for a mall (defined in config/malls.ts).
 * These values do NOT change at runtime — they describe the mall's structure.
 */
export interface MallConfig {
  id: MallId;
  /** Display name shown in UI (e.g. "堺北花田", "須坂") */
  name: string;
  /** Available floors for this mall */
  floors: FloorId[];
  /** Default floor to show on first load */
  defaultFloor: FloorId;
  /** Default floor layout (columns / rows) per floor */
  defaultFloorLayout: FloorLayout;
  /** Video orientation for the main screen */
  videoOrientation: "vertical" | "horizontal";
  /** Whether you need the open-time image area */
  hasOpenTimeImage: boolean;
  /** Whether black-screen overlay is supported */
  hasBlackScreen: boolean;
  /** Genre display order */
  genreOrder: string[];
  /** Genre English mapping */
  genreEnglish: Record<string, string>;
}

/**
 * Per-mall settings persisted to `{mallId}-settings.json`.
 * This is the runtime-editable state for each mall.
 */
export interface MallSettingsFile {
  floorLayout?: FloorLayout;
  locationIcons?: import('./locationIcon').LocationIconSettings;
  imageSettings?: import('./imageSettings').ImageSettings;
  genreMappings?: import('./genreSettings').GenreMappings;
  genreMemoSettings?: import('./genreSettings').GenreMemoSettings;
  shopSettings?: import('./shopSettings').ShopSettings;
  blackScreenSettings?: import('./blackScreenSettings').BlackScreenSettings;
}

/**
 * Global settings persisted to `settings.json`.
 * Minimal — only identifies the active mall + floor + setup state.
 */
export interface GlobalSettings {
  mallId: MallId;
  floor: FloorId;
  setupCompleted?: boolean;
}
