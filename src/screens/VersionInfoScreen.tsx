// src/screens/VersionInfoScreen.tsx
import React, { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

interface Props {
  onClose: () => void;
}

const VersionInfoScreen: React.FC<Props> = ({ onClose }) => {
  const [currentVersion, setCurrentVersion] = useState<string>("");

  useEffect(() => {
    getVersion().then(setCurrentVersion).catch(() => setCurrentVersion("不明"));
  }, []);

  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: Math.max(20, (window.innerWidth - 500) / 2),
    top: Math.max(20, (window.innerHeight - 300) / 2),
  });

  const handleDragMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...windowPos };

    const onMouseMove = (moveEvent: MouseEvent) => {
      setWindowPos({
        left: Math.max(
          0,
          Math.min(window.innerWidth - 200, startPos.left + moveEvent.clientX - startX),
        ),
        top: Math.max(
          0,
          Math.min(window.innerHeight - 100, startPos.top + moveEvent.clientY - startY),
        ),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: windowPos.left,
        top: windowPos.top,
        width: 500,
        maxWidth: "95vw",
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 24,
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        border: "1px solid rgba(255,255,255,0.1)",
        zIndex: 9999,
      }}
    >
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          cursor: "move",
          margin: "-8px -8px 16px -8px",
          padding: "8px 8px 0 8px",
          userSelect: "none",
        }}
      >
        <h2
          style={{
            marginTop: 0,
            marginBottom: 6,
            color: "#ffffff",
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          バージョン情報
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <div
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 6,
            }}
          >
            現在のバージョン
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: "#ffffff" }}>
            {currentVersion || "読み込み中..."}
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            padding: 12,
            backgroundColor: "rgba(255,255,255,0.03)",
            borderRadius: 8,
          }}
        >
          Tauri 2 + React 19
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 24,
          paddingTop: 20,
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #007aff, #00c6ff)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            boxShadow: "0 4px 12px rgba(0, 122, 255, 0.3)",
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
};

export default VersionInfoScreen;
