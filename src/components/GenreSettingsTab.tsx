import React, { useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import type { GenreMappings, GenreDisplayConfig } from "../types/genreSettings";
import { DEFAULT_GENRE_CONFIG } from "../types/genreSettings";

interface GenreSettingsTabProps {
  genreMappings: GenreMappings;
  onChangeGenreMappings: (mappings: GenreMappings) => void;
}

// Helper to convert unknown color string to hex for input[type=color]
// Returns #000000 if invalid or rgba
const toHex = (color: string): string => {
  if (!color) return "#000000";
  if (color.startsWith("#")) {
    return color.substring(0, 7); // Ignore alpha for color input
  }
  // Basic fallback for named colors or rgba (could be improved)
  return "#000000";
};

const ColorInput: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
}> = ({ label, value, onChange }) => {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <label style={{ display: "block", fontSize: 11, marginBottom: 4, opacity: 0.7 }}>
        {label}
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="color"
          value={toHex(value)}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 32,
            height: 32,
            padding: 0,
            border: "none",
            backgroundColor: "transparent",
            cursor: "pointer",
          }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            padding: "0 8px",
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: 4,
            color: "#ffffff",
            fontSize: 13,
          }}
        />
      </div>
    </div>
  );
};

const DraggableItem: React.FC<{
  genre: string;
  config: GenreDisplayConfig;
  isEditing: boolean;
  onToggleEdit: () => void;
  onDelete: () => void;
  onUpdate: (partial: Partial<GenreDisplayConfig>) => void;
}> = ({ genre, config, isEditing, onToggleEdit, onDelete, onUpdate }) => {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={genre}
      dragListener={false}
      dragControls={controls}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 6,
        padding: 12,
        marginBottom: 12,
        listStyle: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isEditing ? 12 : 0 }}>
        <div 
          style={{ 
            display: "flex", 
            alignItems: "center", 
            flex: 1,
            cursor: "grab",
          }}
          onPointerDown={(e) => controls.start(e)}
        >
          {/* Drag Handle Icon */}
          <div style={{ marginRight: 12, opacity: 0.5, display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ width: 16, height: 2, backgroundColor: "#fff" }} />
            <div style={{ width: 16, height: 2, backgroundColor: "#fff" }} />
            <div style={{ width: 16, height: 2, backgroundColor: "#fff" }} />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{genre}</span>
            {!isEditing && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>
                {config.labelEn}
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: config.headerTextColor,
                    marginLeft: 8,
                    border: "1px solid rgba(255,255,255,0.3)"
                  }}
                />
              </span>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
            <button
                onClick={onToggleEdit}
                style={{
                    padding: "4px 12px",
                    backgroundColor: isEditing ? "rgba(255, 255, 255, 0.1)" : "#007aff",
                    border: "none",
                    borderRadius: 4,
                    color: "#ffffff",
                    fontSize: 12,
                    cursor: "pointer",
                }}
            >
                {isEditing ? "閉じる" : "編集"}
            </button>
            {isEditing && (
                <button
                    onClick={onDelete}
                    style={{
                        padding: "4px 12px",
                        backgroundColor: "rgba(255, 68, 68, 0.1)",
                        border: "1px solid rgba(255, 68, 68, 0.3)",
                        borderRadius: 4,
                        color: "#ff4444",
                        fontSize: 12,
                        cursor: "pointer",
                    }}
                >
                    削除
                </button>
            )}
        </div>
      </div>

      {isEditing && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, marginBottom: 4, opacity: 0.7 }}>英語表記</label>
            <input
              type="text"
              value={config.labelEn}
              onChange={(e) => onUpdate({ labelEn: e.target.value })}
              placeholder="English Label"
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                border: "1px solid rgba(255, 255, 255, 0.2)",
                borderRadius: 4,
                color: "#ffffff",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
          
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <ColorInput
                label="ヘッダー文字色"
                value={config.headerTextColor}
                onChange={(v) => onUpdate({ headerTextColor: v })}
            />
            <ColorInput
                label="ヘッダーボーダー色"
                value={config.headerBorderColor}
                onChange={(v) => onUpdate({ headerBorderColor: v })}
            />
            <ColorInput
                label="行背景色 (Striped)"
                value={config.rowBackgroundColor}
                onChange={(v) => onUpdate({ rowBackgroundColor: v })}
            />
          </div>
        </div>
      )}
    </Reorder.Item>
  );
};

export const GenreSettingsTab: React.FC<GenreSettingsTabProps> = ({
  genreMappings,
  onChangeGenreMappings,
}) => {
  const [newGenre, setNewGenre] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);

  // Maintain local order state for Reorder component
  // Initialize from genreMappings keys
  // Note: We need to update this when genreMappings prop changes externally if we want full sync,
  // but for local reordering we drive genreMappings from this list.
  const [order, setOrder] = useState(Object.keys(genreMappings));

  // Sync order when genreMappings changes (e.g. added/deleted externally or initially loaded)
  // We only sync if the keys are different to avoid loop when we update genreMappings ourselves
  React.useEffect(() => {
    const currentKeys = Object.keys(genreMappings);
    const orderSet = new Set(order);
    const keysSet = new Set(currentKeys);
    
    // Check if sets are equal
    const areSetsEqual = orderSet.size === keysSet.size && [...orderSet].every((x) => keysSet.has(x));
    
    // If different (item added/removed), update order
    // But if just reordered, we don't want to reset unless the prop actually changed structure
    if (!areSetsEqual) {
      // Preserve existing order for common keys, append new ones
      const newOrder = [...order.filter(k => keysSet.has(k))];
      currentKeys.forEach(k => {
        if (!orderSet.has(k)) newOrder.push(k);
      });
      setOrder(newOrder);
    }
  }, [genreMappings]);

  const handleReorder = (newOrder: string[]) => {
    setOrder(newOrder);
    
    // Reconstruct genreMappings object with new key order
    const nextMappings: GenreMappings = {};
    newOrder.forEach(key => {
      if (genreMappings[key]) {
        nextMappings[key] = genreMappings[key];
      }
    });
    
    // Add any missing keys (shouldn't happen usually but for safety)
    Object.keys(genreMappings).forEach(key => {
      if (!nextMappings[key]) {
        nextMappings[key] = genreMappings[key];
      }
    });

    onChangeGenreMappings(nextMappings);
  };

  const handleUpdate = (key: string, partial: Partial<GenreDisplayConfig>) => {
    const current = genreMappings[key];
    const nextConfig = { ...current, ...partial };
    onChangeGenreMappings({ ...genreMappings, [key]: nextConfig });
  };

  const handleDelete = (key: string) => {
    if (!confirm(`ジャンル「${key}」の設定を削除しますか？`)) return;
    const next = { ...genreMappings };
    delete next[key];
    onChangeGenreMappings(next);
  };

  const handleAdd = () => {
    if (!newGenre) return;
    if (genreMappings[newGenre]) {
      alert("このジャンルは既に存在します。既存の項目を編集してください。");
      return;
    }
    
    // Add to mappings
    const nextMappings = {
      ...genreMappings,
      [newGenre]: { ...DEFAULT_GENRE_CONFIG },
    };
    
    onChangeGenreMappings(nextMappings);
    setNewGenre("");
    setEditingKey(newGenre);
  };

  return (
    <div style={{ color: "#ffffff", display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 18 }}>ジャンル表記・配色・並び順設定</h3>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.7, lineHeight: 1.5 }}>
          フロアガイドのジャンル名（英語表記）と配色を設定します。<br/>
          ドラッグ＆ドロップで表示順を変更できます。<br/>
          行背景色は `rgba(r,g,b,a)` 形式で指定すると透明度を調整できます。
        </p>
      </div>
      
      <Reorder.Group axis="y" values={order} onReorder={handleReorder} style={{ padding: 0, margin: 0 }}>
        {order.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", opacity: 0.5, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 6 }}>
            設定がありません
          </div>
        )}
        {order.map((genre) => (
          <DraggableItem
            key={genre}
            genre={genre}
            config={genreMappings[genre] || DEFAULT_GENRE_CONFIG}
            isEditing={editingKey === genre}
            onToggleEdit={() => setEditingKey(editingKey === genre ? null : genre)}
            onDelete={() => handleDelete(genre)}
            onUpdate={(partial) => handleUpdate(genre, partial)}
          />
        ))}
      </Reorder.Group>

      <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: 20 }}>
        <h4 style={{ margin: "0 0 12px 0", fontSize: 14 }}>新規追加</h4>
        <div style={{ display: "flex", gap: 12 }}>
          <input
            type="text"
            value={newGenre}
            onChange={(e) => setNewGenre(e.target.value)}
            placeholder="日本語ジャンル名"
            style={{
              flex: 1,
              padding: "8px",
              backgroundColor: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: 4,
              color: "#ffffff",
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={!newGenre}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007aff",
              border: "none",
              borderRadius: 4,
              color: "#ffffff",
              cursor: !newGenre ? "not-allowed" : "pointer",
              opacity: !newGenre ? 0.5 : 1,
              height: 38, // Match input height roughly
              whiteSpace: "nowrap",
            }}
          >
            追加
          </button>
        </div>
      </div>
    </div>
  );
};

