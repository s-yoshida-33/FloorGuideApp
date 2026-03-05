// src/screens/MallSelectScreen.tsx
// Initial setup screen shown on first launch.
// Displays a list of available malls for the user to select.

import React, { useState } from "react";
import type { MallId } from "../types/mall";
import { MALL_CONFIGS, ALL_MALL_IDS } from "../config/malls";
import iconSvg from "../assets/icon.svg";

interface MallSelectScreenProps {
  onSelect: (mallId: MallId) => void;
}

const MallSelectScreen: React.FC<MallSelectScreenProps> = ({ onSelect }) => {
  const [selectedMall, setSelectedMall] = useState<MallId>(ALL_MALL_IDS[0]);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#1C1C1C",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        color: "#ffffff",
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 48,
        }}
      >
        <img src={iconSvg} alt="Gido" style={{ width: 48, height: 48 }} />
        <span style={{ fontSize: 32, fontWeight: 700 }}>Gido</span>
      </div>

      {/* Title */}
      <h2
        style={{
          fontSize: 24,
          fontWeight: 600,
          marginBottom: 32,
          color: "rgba(255, 255, 255, 0.9)",
        }}
      >
        モールを選択してください
      </h2>

      {/* Mall list */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          width: 400,
          maxWidth: "80vw",
        }}
      >
        {ALL_MALL_IDS.map((mallId) => {
          const config = MALL_CONFIGS[mallId];
          const isSelected = selectedMall === mallId;

          return (
            <label
              key={mallId}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "20px 24px",
                backgroundColor: isSelected
                  ? "rgba(0, 122, 255, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
                border: isSelected
                  ? "2px solid #007aff"
                  : "2px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 12,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <input
                type="radio"
                name="mall"
                value={mallId}
                checked={isSelected}
                onChange={() => setSelectedMall(mallId)}
                style={{
                  marginRight: 16,
                  width: 20,
                  height: 20,
                  accentColor: "#007aff",
                }}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {config.name}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "rgba(255, 255, 255, 0.5)",
                    marginTop: 4,
                  }}
                >
                  {mallId} ・ {config.floors.length}フロア ・{" "}
                  {config.videoOrientation === "vertical" ? "縦動画" : "横動画"}
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {/* Confirm button */}
      <button
        onClick={() => onSelect(selectedMall)}
        style={{
          marginTop: 48,
          padding: "16px 64px",
          backgroundColor: "#007aff",
          border: "none",
          borderRadius: 8,
          color: "#ffffff",
          fontSize: 18,
          fontWeight: 600,
          cursor: "pointer",
          transition: "opacity 0.2s",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.opacity = "0.85";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.opacity = "1";
        }}
      >
        決定
      </button>
    </div>
  );
};

export default MallSelectScreen;
