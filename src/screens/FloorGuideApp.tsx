// src/screens/FloorGuideApp.tsx
import React, { useEffect, useState } from "react";

import ShopList from "../components/ShopList";
import type { Shop } from "../types/shop";

import floorMap1F from "../assets/floor-1F-map.svg";
import floorMap2F from "../assets/floor-2F-map.svg";
import floorMap3F from "../assets/floor-3F-map.svg";
import floorMap4F from "../assets/floor-4F-map.svg";
import openTimeImage from '../assets/open-time.svg';

import { APP_CONFIG } from "../config";
import { fetchShops } from "../repositories/shopRepository";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

// Map floor id to image asset
const FLOOR_MAPS: Record<string, string> = {
  "1F": floorMap1F,
  "2F": floorMap2F,
  "3F": floorMap3F,
  "4F": floorMap4F,
};

const FloorGuideApp: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Current floor for this screen (default from APP_CONFIG for non-Electron)
  const [floor, setFloor] = useState<string>(APP_CONFIG.floor);

  // Floor synchronization with Electron main process
  useEffect(() => {
    if (!window.electronAPI?.getFloor) {
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const current = await window.electronAPI!.getFloor();
        if (!cancelled && current) {
          setFloor(current);
        }
      } catch (e) {
        console.error("Failed to get floor from Electron", e);
      }
    };

    init();

    window.electronAPI.onFloorChanged((nextFloor) => {
      if (!cancelled) {
        setFloor(nextFloor);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Select floor map by floor id, fallback to 1F
  const floorMap = FLOOR_MAPS[floor] ?? floorMap1F;

  // Video area width (16:9 aspect ratio)
  const videoWidthVh = TOP_HEIGHT_VH * (9 / 16);

  // Shop list area width
  const listWidthVh = (100 - videoWidthVh);

  // Shop data loading
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchShops();
        if (!cancelled) {
          const cleaned = data.map((s) => ({
            ...s,
            name: s.name.replace(/【.*?】/g, "").trim(),
          }));
          setShops(cleaned);
        }
      } catch (e: any) {
        console.error(e);
        if (!cancelled) {
          setError(e?.message ?? "failed to load");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

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
      <div
        style={{
          display: "flex",
          height: `${TOP_HEIGHT_VH}vh`,
          borderBottom: "1px solid #ddd",
        }}
      >
        {/* Floor map */}
        <div
          style={{
            flex: 2,
            // padding: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={floorMap}
            alt={`Floor map ${floor}`}
            style={{ maxWidth: "100%", maxHeight: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Video area (placeholder) */}
        <div
          style={{
            width: `${videoWidthVh}vh`,
            background: "#000",
            color: "#aaa",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "18px",
            flexShrink: 0,
          }}
        >
          Video Area (reserved)
        </div>
      </div>

      {/* Bottom: shop list + open-time image */}
      <div
        style={{
          height: `${LIST_HEIGHT_VH}vh`,
          display: "flex",
          flexDirection: "row",
          borderTop: "1px solid #ddd",
        }}
      >
        {/* Bottom: shop list */}
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
            <ShopList shops={shops} floor={floor} />
          )}
        </div>
        {/* Bottom: Open-time image */}
        <div
          style={{
            width: `${videoWidthVh}vh`,
            height: `${LIST_HEIGHT_VH}vh`,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            background: "#fff",
            // border: "1px solid #ddd",
            margin: "0 auto",
          }}
        >
          <img
            src={openTimeImage}
            alt="Open Time"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              padding: "30px",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default FloorGuideApp;
