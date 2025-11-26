// src/screens/FloorLayoutSettingsScreen.tsx
import React, { useEffect, useState } from "react";

type FloorId = "1F" | "2F" | "3F" | "4F";

type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
  perColumnPadding?: ColumnPadding[];
};

type FloorLayout = Record<string, FloorLayoutPerFloor>;

interface Props {
  layout: FloorLayout;
  onChangeLayout: (next: FloorLayout) => void;
  onSave: (next: FloorLayout) => Promise<void> | void;
  onCancel: () => void;
}

const floors: FloorId[] = ["1F", "2F", "3F", "4F"];

const FloorLayoutSettingsScreen: React.FC<Props> = ({
  layout,
  onChangeLayout,
  onSave,
  onCancel,
}) => {
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<FloorId>("1F");

  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenFloorLayoutSettings) {
      unsubscribe = window.electronAPI.onOpenFloorLayoutSettings(() => {
        const width = 500;
        const height = 600;
        const left = Math.max(20, (window.innerWidth - width) / 2);
        const top = Math.max(20, (window.innerHeight - height) / 2);
        setWindowPos({ left, top });
        setVisible(true);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
  };

  const handleCancelClick = () => {
    onCancel();
    handleClose();
  };

  const handleSaveClick = async () => {
    try {
      setSaving(true);
      await onSave(layout);
      handleClose();
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (
    floor: FloorId,
    key: "columns" | "rowsPerCol",
    value: string
  ) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;

    const current: FloorLayoutPerFloor = layout[floor] || {
      columns: 0,
      rowsPerCol: 0,
      perColumnRows: [],
      perColumnPadding: [],
    };

    let nextPerColumnRows = current.perColumnRows || [];
    let nextPerColumnPadding = current.perColumnPadding || [];

    if (key === "columns") {
      const columns = Math.max(0, num);
      // Trim or keep per-column rows to match new columns count
      if (columns <= 0) {
        nextPerColumnRows = [];
        nextPerColumnPadding = [];
      } else {
        nextPerColumnRows = nextPerColumnRows.slice(0, columns);
        nextPerColumnPadding = nextPerColumnPadding.slice(0, columns);
      }

      const next: FloorLayout = {
        ...layout,
        [floor]: {
          ...current,
          columns,
          perColumnRows: nextPerColumnRows,
          perColumnPadding: nextPerColumnPadding,
        },
      };

      onChangeLayout(next);
      return;
    }

    if (key === "rowsPerCol") {
      const rowsPerCol = Math.max(0, num);

      const next: FloorLayout = {
        ...layout,
        [floor]: {
          ...current,
          rowsPerCol,
          perColumnRows: nextPerColumnRows,
        },
      };

      onChangeLayout(next);
      return;
    }
  };

  const handlePerColumnRowsChange = (
    floor: FloorId,
    colIndex: number,
    value: string
  ) => {
    const num = Number(value);
    if (Number.isNaN(num)) return;

    const current: FloorLayoutPerFloor = layout[floor] || {
      columns: 0,
      rowsPerCol: 0,
      perColumnRows: [],
      perColumnPadding: [],
    };

    const columns = current.columns || 0;
    if (colIndex < 0 || colIndex >= columns) return;

    const arr = [...(current.perColumnRows || [])];
    arr[colIndex] = Math.max(0, num);

    const next: FloorLayout = {
      ...layout,
      [floor]: {
        ...current,
        perColumnRows: arr,
      },
    };

    onChangeLayout(next);
  };

  const handlePerColumnPaddingChange = (
    floor: FloorId,
    colIndex: number,
    side: "top" | "right" | "bottom" | "left",
    value: string
  ) => {
    const num = value === "" ? undefined : Number(value);
    if (value !== "" && Number.isNaN(num)) return;

    const current: FloorLayoutPerFloor = layout[floor] || {
      columns: 0,
      rowsPerCol: 0,
      perColumnRows: [],
      perColumnPadding: [],
    };

    const columns = current.columns || 0;
    if (colIndex < 0 || colIndex >= columns) return;

    const arr = [...(current.perColumnPadding || [])];
    if (!arr[colIndex]) {
      arr[colIndex] = {};
    }
    const padding = { ...arr[colIndex] };
    if (num !== undefined && num >= 0) {
      padding[side] = num;
    } else {
      delete padding[side];
    }
    arr[colIndex] = padding;

    const next: FloorLayout = {
      ...layout,
      [floor]: {
        ...current,
        perColumnPadding: arr,
      },
    };

    onChangeLayout(next);
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
        width: 500,
        maxWidth: "95vw",
        maxHeight: "90vh",
        backgroundColor: "#1a1a1a",
        borderRadius: 20,
        padding: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
        fontFamily: "'Rounded Mplus 1c', sans-serif",
        border: "1px solid rgba(255,255,255,0.1)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
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
          <h2 style={{ marginTop: 0, marginBottom: 6, color: "#ffffff", fontSize: 20, fontWeight: 600 }}>ショップリストレイアウト</h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 13,
              color: "rgba(255,255,255,0.6)",
              lineHeight: 1.5,
            }}
          >
            フロアを選択して、列数と列ごとの行数を設定します。各列の行数や間隔を個別に上書きすることもできます。変更はメイン画面でリアルタイムにプレビューされます。保存をクリックすると永続的に適用されます。
          </p>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.7)",
              marginBottom: 6,
            }}
          >
            フロア選択
          </div>
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(e.target.value as FloorId)}
            style={{
              width: "100%",
              backgroundColor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              padding: "6px 8px",
              color: "#ffffff",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {floors.map((floor) => (
              <option key={floor} value={floor} style={{ backgroundColor: "#1a1a1a" }}>
                {floor}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            marginRight: -8,
            paddingRight: 8,
          }}
        >
          {(() => {
            const floor = selectedFloor;
            const perFloor = layout[floor];
            const cols = perFloor?.columns ?? 0;
            const perColumnRows = perFloor?.perColumnRows || [];
            const perColumnPadding = perFloor?.perColumnPadding || [];

            return (
              <div
                style={{
                  backgroundColor: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid rgba(255,255,255,0.1)",
                }}
              >

                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                      marginBottom: 6,
                    }}
                  >
                    列数
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={perFloor?.columns ?? ""}
                    onChange={(e) =>
                      handleChange(floor, "columns", e.target.value)
                    }
                    style={{
                      width: "100%",
                      textAlign: "right",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                      marginBottom: 6,
                    }}
                  >
                    行数 / 列（デフォルト）
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={perFloor?.rowsPerCol ?? ""}
                    onChange={(e) =>
                      handleChange(floor, "rowsPerCol", e.target.value)
                    }
                    style={{
                      width: "100%",
                      textAlign: "right",
                      backgroundColor: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      color: "#ffffff",
                      fontSize: 13,
                    }}
                  />
                </div>

                {cols > 0 && (
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: 8,
                      }}
                    >
                      列ごとの行数
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      {Array.from({ length: cols }).map((_, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.7)",
                              minWidth: 40,
                            }}
                          >
                            列 {idx + 1}
                          </span>
                          <input
                            type="number"
                            min={1}
                            max={50}
                            value={perColumnRows[idx] ?? ""}
                            onChange={(e) =>
                              handlePerColumnRowsChange(
                                floor,
                                idx,
                                e.target.value
                              )
                            }
                            style={{
                              flex: 1,
                              textAlign: "right",
                              backgroundColor: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              borderRadius: 6,
                              padding: "4px 6px",
                              color: "#ffffff",
                              fontSize: 12,
                            }}
                          />
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.5)",
                        marginTop: 8,
                      }}
                    >
                      空欄はデフォルト値を使用
                    </div>
                  </div>
                )}

                {cols > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        marginBottom: 8,
                      }}
                    >
                      列ごとの間隔（em）
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {Array.from({ length: cols }).map((_, idx) => {
                        const padding = perColumnPadding[idx] || {};
                        return (
                          <div
                            key={idx}
                            style={{
                              backgroundColor: "rgba(255,255,255,0.02)",
                              borderRadius: 8,
                              padding: 8,
                              border: "1px solid rgba(255,255,255,0.05)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: 10,
                                color: "rgba(255,255,255,0.6)",
                                marginBottom: 6,
                              }}
                            >
                              列 {idx + 1}
                            </div>
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: 6,
                              }}
                            >
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: "rgba(255,255,255,0.5)",
                                    marginBottom: 4,
                                  }}
                                >
                                  上
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={padding.top ?? ""}
                                  onChange={(e) =>
                                    handlePerColumnPaddingChange(
                                      floor,
                                      idx,
                                      "top",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0"
                                  style={{
                                    width: "100%",
                                    textAlign: "right",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                    color: "#ffffff",
                                    fontSize: 11,
                                  }}
                                />
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: "rgba(255,255,255,0.5)",
                                    marginBottom: 4,
                                  }}
                                >
                                  右
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={padding.right ?? ""}
                                  onChange={(e) =>
                                    handlePerColumnPaddingChange(
                                      floor,
                                      idx,
                                      "right",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0"
                                  style={{
                                    width: "100%",
                                    textAlign: "right",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                    color: "#ffffff",
                                    fontSize: 11,
                                  }}
                                />
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: "rgba(255,255,255,0.5)",
                                    marginBottom: 4,
                                  }}
                                >
                                  下
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={padding.bottom ?? ""}
                                  onChange={(e) =>
                                    handlePerColumnPaddingChange(
                                      floor,
                                      idx,
                                      "bottom",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0"
                                  style={{
                                    width: "100%",
                                    textAlign: "right",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                    color: "#ffffff",
                                    fontSize: 11,
                                  }}
                                />
                              </div>
                              <div>
                                <div
                                  style={{
                                    fontSize: 9,
                                    color: "rgba(255,255,255,0.5)",
                                    marginBottom: 4,
                                  }}
                                >
                                  左
                                </div>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.1}
                                  value={padding.left ?? ""}
                                  onChange={(e) =>
                                    handlePerColumnPaddingChange(
                                      floor,
                                      idx,
                                      "left",
                                      e.target.value
                                    )
                                  }
                                  placeholder="0"
                                  style={{
                                    width: "100%",
                                    textAlign: "right",
                                    backgroundColor: "rgba(255,255,255,0.05)",
                                    border: "1px solid rgba(255,255,255,0.1)",
                                    borderRadius: 4,
                                    padding: "4px 6px",
                                    color: "#ffffff",
                                    fontSize: 11,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.5)",
                        marginTop: 8,
                      }}
                    >
                      空欄は0em（間隔なし）
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid rgba(255,255,255,0.1)",
            flexShrink: 0,
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

export default FloorLayoutSettingsScreen;
