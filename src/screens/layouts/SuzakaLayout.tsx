// src/screens/layouts/SuzakaLayout.tsx
// Layout for 須坂 mall — "逆T字型" (inverted-T)
// Top row: shop list (left) + horizontal video (right)
// Bottom row: floor map (full width)
// No open-time image area.

import React, { useRef } from "react";

import ShopList from "../../components/ShopList";
import VerticalVideoSlot from "../../components/VerticalVideoSlot";
import { LocationIconsOverlay } from "../../components/LocationIconsOverlay";

import floorMap1F from "../../assets/malls/suzaka/floor-1F-map.webp";
import floorMap2F from "../../assets/malls/suzaka/floor-2F-map.webp";
import floorMap3F from "../../assets/malls/suzaka/floor-3F-map.webp";

import type { FloorId } from "../../types/floorLayout";
import {
  DEFAULT_GENRE_MAPPINGS,
  DEFAULT_GENRE_MEMO_SETTINGS,
} from "../../types/genreSettings";
import { logInfo, logError } from "../../logs/logging";
import type { LayoutProps } from "./types";

// 4K display (3840×2160) pixel-ratio constants
const VIDEO_HEIGHT_VH = (720 / 2160) * 100;   // ≈ 33.333 vh
const LIST_HEIGHT_VH = (920 / 2160) * 100;     // ≈ 42.592 vh
const MAP_HEIGHT_VH = (1235 / 2160) * 100;     // ≈ 57.175 vh
const VIDEO_WIDTH_VW = (1280 / 3840) * 100;    // ≈ 33.333 vw
const LIST_WIDTH_VW = 100 - VIDEO_WIDTH_VW;    // ≈ 66.667 vw

const FLOOR_MAPS: Record<string, string> = {
  "1F": floorMap1F,
  "2F": floorMap2F,
  "3F": floorMap3F,
};

const DEFAULT_FLOOR_LAYOUT = {
  "1F": { columns: 3, rowsPerCol: 20 },
  "2F": { columns: 2, rowsPerCol: 19 },
  "3F": { columns: 3, rowsPerCol: 20 },
};

const SuzakaLayout: React.FC<LayoutProps> = ({
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
  const floorMapLoggedRef = useRef(false);

  const floorId = floor as FloorId;
  const customFloorMap = floorId
    ? imageSettings?.floorMaps?.[floorId]
    : undefined;
  const floorMap = customFloorMap || FLOOR_MAPS[floor] || floorMap1F;

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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top row: shop list (left) + horizontal video (right) */}
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: `${LIST_HEIGHT_VH}vh`,
          flexShrink: 0,
        }}
      >
        {/* Shop list */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: `${LIST_WIDTH_VW}vw`,
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

        {/* Video area (horizontal 16:9) */}
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: `${VIDEO_WIDTH_VW}vw`,
            height: `${VIDEO_HEIGHT_VH}vh`,
            background: "#000",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              aspectRatio: "16 / 9",
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
              <VerticalVideoSlot key={refreshKey} />
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: floor map (full width) */}
      <div
        style={{
          width: "100vw",
          height: `${MAP_HEIGHT_VH}vh`,
          position: "relative",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginTop: "auto",
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
    </div>
  );
};

export default SuzakaLayout;
