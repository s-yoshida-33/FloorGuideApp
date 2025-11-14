// src/screens/FloorGuideApp.tsx
import React, { useEffect, useState } from "react";

import ShopList from "../components/ShopList";
import type { Shop } from "../types/shop";

import floorMap from "../assets/floor-1F-map.svg";
import { APP_CONFIG } from "../config";
import { fetchShops } from "../repositories/shopRepository";

const LIST_HEIGHT_VH = APP_CONFIG.listHeightVh;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;

const FloorGuideApp: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const floor = APP_CONFIG.floor;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const data = await fetchShops();
        if (!cancelled) {
          setShops(data);
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
        fontFamily: "'Yu Gothic', system-ui, sans-serif",
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
            padding: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <img
            src={floorMap}
            alt="Floor Map"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        </div>

        {/* Video area (placeholder) */}
        <div
          style={{
            flex: 1,
            background: "#000",
            color: "#aaa",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "18px",
          }}
        >
          Video Area (reserved)
        </div>
      </div>

      {/* Bottom: shop list */}
      <div style={{ height: `${LIST_HEIGHT_VH}vh` }}>
        {error ? (
          <div style={{ padding: "16px 32px", color: "red" }}>Error: {error}</div>
        ) : (
          <ShopList shops={shops} floor={floor} />
        )}
      </div>
    </div>
  );
};

export default FloorGuideApp;
