// src/types/global.d.ts
export {};

import type {
  CurrentAsset,
  WspCurrentTimelineResponse,
  WspTimelineResponse,
} from './wsp';

declare global {
  interface Window {
    __BWP_BASE_URL__?: string;

    electronAPI?: {
      getFloor: () => Promise<string>;
      onFloorChanged: (cb: (floor: string) => void) => void;
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
