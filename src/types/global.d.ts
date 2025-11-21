// src/types/global.d.ts
export {};

import type {
  CurrentAsset,
  WspCurrentTimelineResponse,
  WspTimelineResponse,
} from './wsp';

import type { LocationIconSettings } from './locationIcon';

declare global {
  interface Window {
    __BWP_BASE_URL__?: string;

    electronAPI?: {
      getFloor: () => Promise<string>;
      onFloorChanged: (cb: (floor: string) => void) => void;

      getLocationIconSettings?: () => Promise<LocationIconSettings>;
      saveLocationIconSettings?: (
        settings: LocationIconSettings
      ) => Promise<LocationIconSettings>;
      onLocationIconSettingsUpdated?: (
        cb: (settings: LocationIconSettings) => void
      ) => () => void;
      onOpenLocationIconSettings?: (cb: () => void) => () => void;
    };

    updater?: {
      onStatus: (cb: (data: any) => void) => void;
      onProgress: (cb: (data: any) => void) => void;
    };

    appInfo?: {
      getVersion: () => Promise<string>;
    };

    wspApi?: {
      getCurrentAsset: () => Promise<CurrentAsset | null>;
      getCurrentTimeline: () => Promise<WspCurrentTimelineResponse | null>;
      getTimeline: (hour?: number) => Promise<WspTimelineResponse | null>;
    };
  }
}
