// src/screens/FloorSettingsScreen.tsx
import React, { useEffect, useState } from "react";

type FloorId = "1F" | "2F" | "3F" | "4F";

interface Props {
  floor: FloorId;
  onChangeFloor: (floor: FloorId) => void;
  onSave: (floor: FloorId) => Promise<void> | void;
  onCancel: () => void;
}

const floors: FloorId[] = ["1F", "2F", "3F", "4F"];

const FloorSettingsScreen: React.FC<Props> = ({
  floor,
  onChangeFloor,
  onSave,
  onCancel,
}) => {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentFloor, setCurrentFloor] = useState<FloorId>(floor);

  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenFloorSettings) {
      unsubscribe = window.electronAPI.onOpenFloorSettings(() => {
        const width = 400;
        const height = 280;
        const left = Math.max(20, (window.innerWidth - width) / 2);
        const top = Math.max(20, (window.innerHeight - height) / 2);
        setWindowPos({ left, top });
        setCurrentFloor(floor);
        setVisible(true);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [floor]);

  const handleClose = () => {
    setVisible(false);
  };

  const handleCancelClick = () => {
    onCancel();
    setCurrentFloor(floor);
    handleClose();
  };

  const handleSaveClick = async () => {
    try {
      setSaving(true);
      await onSave(currentFloor);
      handleClose();
    } finally {
      setSaving(false);
    }
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

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        left: windowPos.left,
        top: windowPos.top,
        width: 400,
        maxWidth: "95vw",
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
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
          <h2 style={{ marginTop: 0, marginBottom: 6, color: "#ffffff", fontSize: 20, fontWeight: 600 }}>フロア設定</h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            表示するフロアを選択してください。変更はメイン画面でリアルタイムにプレビューされます。保存をクリックすると永続的に適用されます。
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 12,
          }}
        >
          {floors.map((f) => (
            <label
              key={f}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 18px",
                borderRadius: 12,
                border: `2px solid ${
                  currentFloor === f ? "#007aff" : "rgba(255,255,255,0.1)"
                }`,
                backgroundColor: currentFloor === f
                  ? "rgba(0, 122, 255, 0.15)"
                  : "rgba(255,255,255,0.03)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: currentFloor === f
                  ? "0 4px 12px rgba(0, 122, 255, 0.2)"
                  : "none",
              }}
              onClick={() => {
                setCurrentFloor(f);
                onChangeFloor(f);
              }}
            >
              <input
                type="radio"
                name="floor"
                value={f}
                checked={currentFloor === f}
                onChange={() => {
                  setCurrentFloor(f);
                  onChangeFloor(f);
                }}
                style={{
                  width: 20,
                  height: 20,
                  cursor: "pointer",
                  accentColor: "#007aff",
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: currentFloor === f ? 600 : 400,
                  color: currentFloor === f ? "#007aff" : "rgba(255,255,255,0.9)",
                }}
              >
                {f}
              </span>
            </label>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 24,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <button
            type="button"
            onClick={handleCancelClick}
            style={{
              padding: "10px 20px",
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
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            style={{
              padding: "10px 24px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #007aff, #00c6ff)",
              color: "#fff",
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: 14,
              opacity: saving ? 0.6 : 1,
              transition: "all 0.2s ease",
              boxShadow: "0 4px 12px rgba(0, 122, 255, 0.3)",
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 122, 255, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 122, 255, 0.3)";
            }}
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
    </div>
  );
};

export default FloorSettingsScreen;

