import type { FloorId } from "./floorLayout";

export type ImageSettings = {
  floorMaps: Record<FloorId, string>; // 各階のマップ画像パス（SVGファイルのパスまたはdata URL）
  openTimeImage: string; // 営業時間画像パス（SVGファイルのパスまたはdata URL）
};

export const DEFAULT_IMAGE_SETTINGS: ImageSettings = {
  floorMaps: {
    "1F": "",
    "2F": "",
    "3F": "",
    "4F": "",
  },
  openTimeImage: "",
};




