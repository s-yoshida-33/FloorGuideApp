import type { FloorId } from "./floorLayout";

export type BannerDisplayMode = 'stack' | 'carousel';

export type BannerSettings = {
  enabled: boolean;
  images: string[];
  displayMode: BannerDisplayMode;
  carouselIntervalMs: number;
};

export const DEFAULT_BANNER_SETTINGS: BannerSettings = {
  enabled: false,
  images: [],
  displayMode: 'carousel',
  carouselIntervalMs: 5000,
};

export type ImageSettings = {
  floorMaps: Record<FloorId, string>; // 各階のマップ画像パス（SVGファイルのパスまたはdata URL）
  openTimeImage: string; // 営業時間画像パス（SVGファイルのパスまたはdata URL）
  banner: BannerSettings;
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  floorMaps: {
    "1F": "",
    "2F": "",
    "3F": "",
    "4F": "",
  },
  openTimeImage: "",
  banner: DEFAULT_BANNER_SETTINGS,
};




