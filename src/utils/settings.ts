import { invoke } from '@tauri-apps/api/core';
import type { FloorId, FloorLayout } from '../types/floorLayout';
import type { LocationIconSettings } from '../types/locationIcon';
import type { ImageSettings } from '../types/imageSettings';
import type { GenreMappings, GenreMemoSettings } from '../types/genreSettings';
import type { ShopSettings } from '../types/shopSettings';
import type { BlackScreenSettings } from '../types/blackScreenSettings';
import { DEFAULT_IMAGE_SETTINGS } from '../types/imageSettings';
import { DEFAULT_GENRE_MAPPINGS, DEFAULT_GENRE_MEMO_SETTINGS } from '../types/genreSettings';
import { DEFAULT_BLACK_SCREEN_SETTINGS } from '../types/blackScreenSettings';
import { DEFAULT_LOCATION_ICON_SETTINGS } from '../config';
import { logInfo, logError } from '../logs/logging';

/**
 * Full settings structure persisted to disk.
 */
export interface GidoSettings {
  floor?: FloorId;
  floorLayout?: FloorLayout;
  locationIcons?: LocationIconSettings;
  imageSettings?: ImageSettings;
  genreMappings?: GenreMappings;
  genreMemoSettings?: GenreMemoSettings;
  shopSettings?: ShopSettings;
  blackScreenSettings?: BlackScreenSettings;
}

const DEFAULT_FLOOR_LAYOUT: FloorLayout = {
  '1F': { columns: 3, rowsPerCol: 20 },
  '2F': { columns: 2, rowsPerCol: 19 },
  '3F': { columns: 3, rowsPerCol: 20 },
  '4F': { columns: 2, rowsPerCol: 18 },
};

/**
 * Load all settings from disk via Rust backend.
 * Merges with defaults for missing fields.
 */
export async function loadSettings(): Promise<GidoSettings> {
  try {
    const json = await invoke<string>('get_settings');
    const raw = JSON.parse(json) as Partial<GidoSettings>;

    return {
      floor: raw.floor ?? '1F',
      floorLayout: raw.floorLayout
        ? { ...DEFAULT_FLOOR_LAYOUT, ...raw.floorLayout }
        : DEFAULT_FLOOR_LAYOUT,
      locationIcons: mergeLocationIcons(raw.locationIcons),
      imageSettings: raw.imageSettings
        ? { ...DEFAULT_IMAGE_SETTINGS, ...raw.imageSettings }
        : DEFAULT_IMAGE_SETTINGS,
      genreMappings: raw.genreMappings
        ? { ...DEFAULT_GENRE_MAPPINGS, ...raw.genreMappings }
        : DEFAULT_GENRE_MAPPINGS,
      genreMemoSettings: raw.genreMemoSettings
        ? { ...DEFAULT_GENRE_MEMO_SETTINGS, ...raw.genreMemoSettings }
        : DEFAULT_GENRE_MEMO_SETTINGS,
      shopSettings: raw.shopSettings ?? {},
      blackScreenSettings: raw.blackScreenSettings
        ? { ...DEFAULT_BLACK_SCREEN_SETTINGS, ...raw.blackScreenSettings }
        : DEFAULT_BLACK_SCREEN_SETTINGS,
    };
  } catch (error) {
    logError('CONFIG', 'Failed to load settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    // Return full defaults on error
    return {
      floor: '1F',
      floorLayout: DEFAULT_FLOOR_LAYOUT,
      locationIcons: DEFAULT_LOCATION_ICON_SETTINGS,
      imageSettings: DEFAULT_IMAGE_SETTINGS,
      genreMappings: DEFAULT_GENRE_MAPPINGS,
      genreMemoSettings: DEFAULT_GENRE_MEMO_SETTINGS,
      shopSettings: {},
      blackScreenSettings: DEFAULT_BLACK_SCREEN_SETTINGS,
    };
  }
}

/**
 * Save all settings to disk via Rust backend.
 */
export async function saveAllSettings(settings: GidoSettings): Promise<void> {
  try {
    const json = JSON.stringify(settings, null, 2);
    await invoke('save_settings', { json });
    logInfo('CONFIG', 'Settings saved successfully');
  } catch (error) {
    logError('CONFIG', 'Failed to save settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Partially update settings: load current → merge → save.
 */
export async function updateSettings(
  partial: Partial<GidoSettings>,
): Promise<GidoSettings> {
  const current = await loadSettings();
  const merged: GidoSettings = { ...current, ...partial };
  await saveAllSettings(merged);
  return merged;
}

/**
 * Save image file via Rust backend (receives raw bytes, no Base64).
 * Returns the absolute path to the saved file.
 */
export async function saveImageFile(
  filename: string,
  data: Uint8Array,
): Promise<string> {
  const response = await invoke<{ success: boolean; path: string }>(
    'save_image_file',
    { filename, data: Array.from(data) },
  );
  return response.path;
}

/**
 * Get absolute path of an image file in the images directory.
 * Returns empty string if file does not exist.
 */
export async function getImagePath(filename: string): Promise<string> {
  return invoke<string>('get_image_path', { filename });
}

/**
 * Delete an image file from the images directory.
 */
export async function deleteImageFile(filename: string): Promise<boolean> {
  return invoke<boolean>('delete_image_file', { filename });
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function mergeLocationIcons(
  raw: LocationIconSettings | undefined,
): LocationIconSettings {
  if (!raw) return DEFAULT_LOCATION_ICON_SETTINGS;

  return {
    speechBubble: {
      ...DEFAULT_LOCATION_ICON_SETTINGS.speechBubble,
      ...raw.speechBubble,
      shadow:
        raw.speechBubble?.shadow ??
        DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.shadow,
      animation:
        raw.speechBubble?.animation ??
        DEFAULT_LOCATION_ICON_SETTINGS.speechBubble.animation,
    },
    location: {
      ...DEFAULT_LOCATION_ICON_SETTINGS.location,
      ...raw.location,
      shadow:
        raw.location?.shadow ??
        DEFAULT_LOCATION_ICON_SETTINGS.location.shadow,
    },
  };
}
