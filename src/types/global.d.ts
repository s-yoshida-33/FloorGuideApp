// src/types/global.d.ts
export {};

import type {
  CurrentAsset,
  WspCurrentTimelineResponse,
  WspTimelineResponse,
} from "./wsp";

import type { LocationIconSettings } from "./locationIcon";

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

interface ElectronAPI {
  getFloor: () => Promise<string>;
  setFloor: (floor: string) => void;
  onFloorChanged: (cb: (floor: string) => void) => void;

  getLocationIconSettings: () => Promise<LocationIconSettings>;
  saveLocationIconSettings: (
    settings: LocationIconSettings
  ) => Promise<LocationIconSettings>;
  onLocationIconSettingsUpdated: (
    cb: (settings: LocationIconSettings) => void
  ) => () => void;
  onOpenLocationIconSettings: (cb: () => void) => () => void;

  onUpdateFloorLayout?: (
    callback: (payload: {
      floor: string;
      columns: number;
      rowsPerCol: number;
    }) => void
  ) => void;

  getFloorLayout: () => Promise<FloorLayout>;
  saveFloorLayout: (layout: FloorLayout) => Promise<FloorLayout>;
  onFloorLayoutChanged: (cb: (layout: FloorLayout) => void) => () => void;
  onOpenFloorLayoutSettings: (cb: () => void) => () => void;
  onOpenFloorSettings: (cb: () => void) => () => void;
  onOpenVersionInfo: (cb: () => void) => () => void;
  manualUpdateCheck: () => void;
  oneClickUpdate: () => void;
  quitApp: () => void;
}

export type StatusState = 'checking' | 'available' | 'none' | 'downloaded' | 'error';

export interface UpdaterAPI {
  onStatus: (cb: (data: { state: StatusState; message: string }) => void) => void;
  onProgress: (cb: (data: {
    percent: number;
    transferred: number;
    total: number;
    speed: number;
  }) => void) => void;
}

export interface AppInfoAPI {
  getVersion: () => Promise<string>;
  getLatestVersionInfo: () => Promise<{
    version: string;
    releaseDate?: string;
    releaseNotes?: string;
  } | null>;
}

interface WspApi {
  getCurrentAsset: () => Promise<CurrentAsset | null>;
  getCurrentTimeline: () => Promise<WspCurrentTimelineResponse | null>;
  getTimeline: (hour?: number) => Promise<WspTimelineResponse | null>;
}

interface LoggerApi {
  log: (
    level: string,
    message: string,
    context?: Record<string, unknown>
  ) => void;
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    __BWP_BASE_URL__?: string;

    electronAPI?: ElectronAPI;
    updater?: UpdaterAPI;
    appInfo?: AppInfoAPI;
    wspApi?: WspApi;
    logger?: LoggerApi;
  }
}
