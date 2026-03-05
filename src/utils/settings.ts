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
import type { MallId, GlobalSettings, MallSettingsFile } from '../types/mall';
import { getMallConfig } from '../config/malls';

// ============================================================================
// Legacy GidoSettings type (kept for backward-compatibility during migration)
// ============================================================================

/**
 * Full settings structure persisted to disk.
 * @deprecated Use GlobalSettings + MallSettingsFile instead.
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

// ============================================================================
// Global Settings (settings.json)
// ============================================================================

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  mallId: 'sakaikitahanada',
  setupCompleted: false,
};

export async function loadGlobalSettings(): Promise<GlobalSettings> {
  try {
    const json = await invoke<string>('get_settings');
    const raw = JSON.parse(json) as Partial<GlobalSettings>;
    return {
      mallId: raw.mallId ?? DEFAULT_GLOBAL_SETTINGS.mallId,
      setupCompleted: raw.setupCompleted ?? DEFAULT_GLOBAL_SETTINGS.setupCompleted,
    };
  } catch (error) {
    logError('CONFIG', 'Failed to load global settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
}

export async function saveGlobalSettings(settings: GlobalSettings): Promise<void> {
  try {
    const json = JSON.stringify(settings, null, 2);
    await invoke('save_settings', { json });
    logInfo('CONFIG', 'Global settings saved', { mallId: settings.mallId });
  } catch (error) {
    logError('CONFIG', 'Failed to save global settings', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Per-mall Settings ({mallId}-settings.json)
// ============================================================================

function getMallSettingsFilename(mallId: MallId): string {
  return `${mallId}-settings.json`;
}

function getDefaultMallSettingsFile(mallId: MallId): MallSettingsFile {
  const config = getMallConfig(mallId);
  return {
    floor: config.defaultFloor,
    floorLayout: config.defaultFloorLayout,
    locationIcons: DEFAULT_LOCATION_ICON_SETTINGS,
    imageSettings: DEFAULT_IMAGE_SETTINGS,
    genreMappings: DEFAULT_GENRE_MAPPINGS,
    genreMemoSettings: DEFAULT_GENRE_MEMO_SETTINGS,
    shopSettings: {},
    blackScreenSettings: DEFAULT_BLACK_SCREEN_SETTINGS,
  };
}

export async function loadMallSettings(mallId: MallId): Promise<MallSettingsFile> {
  try {
    const filename = getMallSettingsFilename(mallId);
    const json = await invoke<string>('get_named_settings', { filename });
    const raw = JSON.parse(json) as Partial<MallSettingsFile>;
    const defaults = getDefaultMallSettingsFile(mallId);

    return {
      floor: raw.floor ?? defaults.floor,
      floorLayout: raw.floorLayout
        ? { ...defaults.floorLayout, ...raw.floorLayout }
        : defaults.floorLayout,
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
    logError('CONFIG', `Failed to load mall settings for ${mallId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return getDefaultMallSettingsFile(mallId);
  }
}

export async function saveMallSettings(
  mallId: MallId,
  settings: MallSettingsFile,
): Promise<void> {
  try {
    const filename = getMallSettingsFilename(mallId);
    const json = JSON.stringify(settings, null, 2);
    await invoke('save_named_settings', { filename, json });
    logInfo('CONFIG', `Mall settings saved for ${mallId}`);
  } catch (error) {
    logError('CONFIG', `Failed to save mall settings for ${mallId}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export async function mallSettingsFileExists(mallId: MallId): Promise<boolean> {
  try {
    const filename = getMallSettingsFilename(mallId);
    return await invoke<boolean>('settings_file_exists', { filename });
  } catch {
    return false;
  }
}

/**
 * Ensure a per-mall settings file exists. If not, create it with defaults.
 */
export async function ensureMallSettingsFile(mallId: MallId): Promise<void> {
  const exists = await mallSettingsFileExists(mallId);
  if (!exists) {
    logInfo('CONFIG', `Creating default settings file for ${mallId}`);
    const defaults = getDefaultMallSettingsFile(mallId);
    await saveMallSettings(mallId, defaults);
  }
}

// ============================================================================
// Legacy single-file migration
// ============================================================================

/**
 * Migrate from the old single-file settings (v1.x) to the new 2-layer model.
 * Called once on startup. If the old settings.json contains mall-specific data
 * (floorLayout, locationIcons, etc.) AND no per-mall file exists yet,
 * move those fields into sakaikitahanada-settings.json and rewrite settings.json
 * to the new GlobalSettings format.
 */
export async function migrateFromLegacyIfNeeded(): Promise<void> {
  try {
    const json = await invoke<string>('get_settings');
    const raw = JSON.parse(json);

    // Already migrated if mallId exists
    if (raw.mallId !== undefined) {
      // v2 migration: move floor from global to per-mall settings if still present
      if (raw.floor !== undefined) {
        const mid: MallId = raw.mallId;
        try {
          const ms = await loadMallSettings(mid);
          if (ms.floor === undefined || ms.floor === getMallConfig(mid).defaultFloor) {
            await saveMallSettings(mid, { ...ms, floor: raw.floor });
          }
        } catch { /* ignore */ }
        // Remove floor from global settings
        const { floor: _removed, ...rest } = raw;
        await saveGlobalSettings({
          mallId: rest.mallId ?? DEFAULT_GLOBAL_SETTINGS.mallId,
          setupCompleted: rest.setupCompleted ?? false,
        });
        logInfo('CONFIG', 'Migrated floor from global to per-mall settings');
      }
      return;
    }

    // Old format detected — migrate
    logInfo('CONFIG', 'Migrating from legacy single-file settings');

    const mallId: MallId = 'sakaikitahanada';
    const exists = await mallSettingsFileExists(mallId);

    if (!exists) {
      // Extract mall-specific fields from old settings.json
      const mallSettings: MallSettingsFile = {
        floor: raw.floor ?? '1F',
        floorLayout: raw.floorLayout,
        locationIcons: raw.locationIcons,
        imageSettings: raw.imageSettings,
        genreMappings: raw.genreMappings,
        genreMemoSettings: raw.genreMemoSettings,
        shopSettings: raw.shopSettings,
        blackScreenSettings: raw.blackScreenSettings,
      };
      await saveMallSettings(mallId, mallSettings);
      logInfo('CONFIG', 'Legacy mall settings migrated to sakaikitahanada-settings.json');
    }

    // Rewrite settings.json as GlobalSettings
    const globalSettings: GlobalSettings = {
      mallId,
      setupCompleted: true, // existing install = setup already done
    };
    await saveGlobalSettings(globalSettings);
    logInfo('CONFIG', 'Legacy global settings migrated');
  } catch (error) {
    logError('CONFIG', 'Legacy migration failed (non-fatal)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ============================================================================
// Backward-compatible loadSettings / saveAllSettings
// ============================================================================

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
