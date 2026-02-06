// src/screens/DeviceCodeScreen.tsx
import React, { useEffect, useState } from "react";
import { logInfo, logError } from "../logs/logging";

interface Props {
  onClose?: () => void;
}

const DeviceCodeScreen: React.FC<Props> = () => {
  const [visible, setVisible] = useState(false);
  const [deviceCode, setDeviceCode] = useState<string | null>(null);

  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenDeviceCode) {
      unsubscribe = window.electronAPI.onOpenDeviceCode(() => {
        const width = 600;
        const height = 500;
        const left = Math.max(20, (window.innerWidth - width) / 2);
        const top = Math.max(20, (window.innerHeight - height) / 2);
        setWindowPos({ left, top });
        setVisible(true);
        loadDeviceCode();
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loadDeviceCode = async () => {
    try {
      if (window.electronAPI?.getDeviceCode) {
        const code = await window.electronAPI.getDeviceCode();
        setDeviceCode(code || "未発行");
      }
    } catch (error) {
      logError("video", "Failed to load device code for modal", { error });
      setDeviceCode("取得エラー");
    }
  };

  const handleClose = () => {
    setVisible(false);
  };

  const handleDragMouseDown: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { ...windowPos };

    const onMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      const nextLeft = startPos.left + dx;
      const nextTop = startPos.top + dy;

      setWindowPos({
        left: Math.max(0, Math.min(window.innerWidth - 200, nextLeft)),
        top: Math.max(0, Math.min(window.innerHeight - 100, nextTop)),
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleCopy = () => {
    if (deviceCode && deviceCode !== "未発行" && deviceCode !== "取得エラー") {
        navigator.clipboard.writeText(deviceCode)
            .then(() => {
                logInfo('video', 'Device code copied to clipboard');
                // Could show a toast here
            })
            .catch(err => {
                logError('video', 'Failed to copy device code', { error: err });
            });
    }
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: windowPos.left,
        top: windowPos.top,
        width: 600,
        maxWidth: "95vw",
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 32,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        border: "1px solid rgba(255,255,255,0.1)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }}
    >
      <div
        onMouseDown={handleDragMouseDown}
        style={{
          cursor: "move",
          margin: "-32px -32px 16px -32px",
          padding: "32px 32px 0 32px",
          userSelect: "none",
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          justifyContent: "center"
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 10, color: "#ffffff", fontSize: 24, fontWeight: 600 }}>
          デバイスコード
        </h2>
      </div>

      <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20
      }}>
          <div style={{ 
            fontSize: '4rem', 
            fontWeight: 'bold', 
            letterSpacing: '0.4rem',
            border: '4px solid rgba(255, 255, 255, 0.2)',
            padding: '1.5rem 3rem',
            borderRadius: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.3)',
            fontFamily: 'monospace',
            color: '#fff',
            whiteSpace: 'nowrap'
          }}>
            {deviceCode || "..."}
          </div>
          
          <div style={{ 
            fontSize: '1rem', 
            color: "rgba(255,255,255,0.7)",
            textAlign: 'center',
            lineHeight: 1.5
          }}>
            管理画面の端末登録ページで<br/>上記コードを入力してください
          </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 16,
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid rgba(255,255,255,0.1)",
          width: "100%"
        }}
      >
        <button
          type="button"
          onClick={handleCopy}
          style={{
            padding: "12px 24px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.2)",
            backgroundColor: "rgba(255,255,255,0.05)",
            color: "rgba(255,255,255,0.9)",
            cursor: "pointer",
            fontWeight: 500,
            fontSize: 14,
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)";
          }}
        >
          コピー
        </button>
        <button
          type="button"
          onClick={handleClose}
          style={{
            padding: "12px 28px",
            borderRadius: 10,
            border: "none",
            background: "linear-gradient(135deg, #007aff, #00c6ff)",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: 14,
            transition: "all 0.2s ease",
            boxShadow: "0 4px 12px rgba(0, 122, 255, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-1px)";
            e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 122, 255, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 122, 255, 0.3)";
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
};

export default DeviceCodeScreen;
