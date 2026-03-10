// src/screens/layouts/SakaikitahanadaLayout.tsx
// Layout for 堺北花田 mall — "田の字型" (2×2 grid)
// Top: floor map (left) + vertical video (right)
// Bottom: shop list (left) + open-time image (right)

import React, { useRef } from "react";

import ShopList from "../../components/ShopList";
import VerticalVideoSlot from "../../components/VerticalVideoSlot";
import { LocationIconsOverlay } from "../../components/LocationIconsOverlay";

import floorMap1F from "../../assets/malls/sakaikitahanada/floor-1F-map.webp";
import floorMap2F from "../../assets/malls/sakaikitahanada/floor-2F-map.webp";
import floorMap3F from "../../assets/malls/sakaikitahanada/floor-3F-map.webp";
import floorMap4F from "../../assets/malls/sakaikitahanada/floor-4F-map.webp";
import openTimeImage from "../../assets/malls/sakaikitahanada/open-time.webp";

import { APP_CONFIG } from "../../config";
import type { FloorId } from "../../types/floorLayout";
import {
  DEFAULT_GENRE_MAPPINGS,
  DEFAULT_GENRE_MEMO_SETTINGS,
} from "../../types/genreSettings";
import { logInfo, logError } from "../../logs/logging";
import type { LayoutProps } from "./types";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

const FLOOR_MAPS: Record<string, string> = {
  "1F": floorMap1F,
  "2F": floorMap2F,
  "3F": floorMap3F,
  "4F": floorMap4F,
};

const DEFAULT_FLOOR_LAYOUT = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
  "4F": { columns: 2, rowsPerCol: 18 },
};

const SakaikitahanadaLayout: React.FC<LayoutProps> = ({
  shops,
  floor,
  floorLayout,
  locationIconSettings,
  imageSettings,
  genreMappings = DEFAULT_GENRE_MAPPINGS,
  genreMemoSettings = DEFAULT_GENRE_MEMO_SETTINGS,
  shopSettings,
  isPreview = false,
  refreshKey,
  error,
}) => {
  const floorMapRef = useRef<HTMLImageElement>(null);
  const openTimeImageRef = useRef<HTMLImageElement>(null);
  const floorMapLoggedRef = useRef(false);
  const openTimeLoggedRef = useRef(false);

  const floorId = floor as FloorId;
  const customFloorMap = floorId
    ? imageSettings?.floorMaps?.[floorId]
    : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || floorMap1F;

  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);
  const listWidthVh = 100 - videoWidthVh;

  const currentLayout =
    floorLayout[floor] ??
    DEFAULT_FLOOR_LAYOUT[floor as keyof typeof DEFAULT_FLOOR_LAYOUT] ??
    DEFAULT_FLOOR_LAYOUT["1F"];

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        fontWeight: 700,
      }}
    >
      {/* Top: map + video area */}
      <div style={{ display: "flex", height: `${TOP_HEIGHT_VH}vh` }}>
        {/* Floor map */}
        <div
          style={{
            flex: 2,
            position: "relative",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            ref={floorMapRef}
            src={floorMap}
            alt={`Floor map ${floor}`}
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
            onLoad={() => {
              if (!floorMapLoggedRef.current) {
                logInfo("ASSET_CHECK", "Floor map rendered", { floor });
                floorMapLoggedRef.current = true;
              }
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Floor map load failed", {
                floor,
                reason: "FILE_NOT_FOUND_OR_CORRUPT",
              });
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
          <LocationIconsOverlay settings={locationIconSettings} />
        </div>

        {/* Video area (vertical 9:16) */}
        <div
          style={{
            width: `${videoWidthVh}vh`,
            background: "#000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxHeight: "100%",
              aspectRatio: "9 / 16",
              overflow: "hidden",
              background: "#000",
            }}
          >
            {isPreview ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#555",
                  fontSize: "1.5vh",
                  fontWeight: "normal",
                }}
              >
                (設定中は非表示)
              </div>
            ) : (
              <VerticalVideoSlot />
            )}
          </div>
        </div>
      </div>

      {/* Bottom: shop list + open-time image */}
      <div
        style={{
          height: `${LIST_HEIGHT_VH}vh`,
          display: "flex",
          flexDirection: "row",
        }}
      >
        <div
          style={{
            flex: 2,
            width: `${listWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
          }}
        >
          {error ? (
            <div style={{ padding: "16px 32px", color: "red" }}>
              Error: {error}
            </div>
          ) : (
            <ShopList
              shops={shops}
              floor={floor}
              columnCount={currentLayout.columns}
              rowsPerColumn={currentLayout.rowsPerCol}
              perColumnRows={currentLayout.perColumnRows}
              perColumnPadding={currentLayout.perColumnPadding}
              genreMappings={genreMappings}
              genreMemoSettings={genreMemoSettings}
              shopSettings={shopSettings}
            />
          )}
        </div>

        {/* Open-time image */}
        <div
          style={{
            width: `${videoWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#fff",
            margin: "0 auto",
          }}
        >
          <img
            ref={openTimeImageRef}
            src={imageSettings?.openTimeImage || openTimeImage}
            alt="Open Time"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              padding: "1.4em",
            }}
            onLoad={() => {
              if (!openTimeLoggedRef.current) {
                logInfo("ASSET_CHECK", "Open-time image loaded");
                openTimeLoggedRef.current = true;
              }
            }}
            onError={(event) => {
              logError("ASSET_CHECK", "Failed to load open-time image");
              (event.target as HTMLImageElement).style.visibility = "hidden";
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default SakaikitahanadaLayout;
