// src/screens/FloorGuideApp.tsx
import React, { useEffect, useState } from "react";

import ShopList from "../components/ShopList";
import type { RawShop } from "../components/ShopList";

import floorMap from "../assets/floor-1F-map.svg";

const LIST_HEIGHT_VH = 37;
const TOP_HEIGHT_VH = 100 - LIST_HEIGHT_VH;
const API_BASE = "http://localhost:8080";

const FloorGuideApp: React.FC = () => {
  const [shops, setShops] = useState<RawShop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const floor = "1F";

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/shops`);
        const json = await res.json();

        const arr: RawShop[] = Array.isArray(json.data)
          ? json.data
          : Array.isArray(json.items)
          ? json.items
          : json;

        setShops(arr);
      } catch (e: any) {
        setError(e?.message ?? "failed to load");
      }
    })();
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden", // no scroll
        fontFamily: "'Yu Gothic', system-ui, sans-serif",
      }}
    >
      {/* top: map + video */}
      <div
        style={{
          display: "flex",
          height: `${TOP_HEIGHT_VH}vh`,
          borderBottom: "1px solid #ddd",
        }}
      >
        {/* map */}
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

        {/* video placeholder */}
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

      {/* bottom: plain text shop list */}
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
