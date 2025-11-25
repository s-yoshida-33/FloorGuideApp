// src/screens/FloorLayoutSettingsScreen.tsx
import React, { useEffect, useState } from "react";

type FloorId = "1F" | "2F" | "3F" | "4F";

type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
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

  const [windowPos, setWindowPos] = useState<{ left: number; top: number }>({
    left: 0,
    top: 0,
  });

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    if (window.electronAPI?.onOpenFloorLayoutSettings) {
      unsubscribe = window.electronAPI.onOpenFloorLayoutSettings(() => {
        const width = 520;
        const height = 400;
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
    };

    let nextPerColumnRows = current.perColumnRows || [];

    if (key === "columns") {
      const columns = Math.max(0, num);
      // Trim or keep per-column rows to match new columns count
      if (columns <= 0) {
        nextPerColumnRows = [];
      } else {
        nextPerColumnRows = nextPerColumnRows.slice(0, columns);
      }

      const next: FloorLayout = {
        ...layout,
        [floor]: {
          ...current,
          columns,
          perColumnRows: nextPerColumnRows,
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
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.2)",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          position: "fixed",
          left: windowPos.left,
          top: windowPos.top,
          width: 520,
          maxWidth: "95vw",
          backgroundColor: "rgba(255, 255, 255)",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 16px 32px rgba(0,0,0,0.25)",
          fontFamily: "'Rounded Mplus 1c', sans-serif",
        }}
      >
        <div
          onMouseDown={handleDragMouseDown}
          style={{
            cursor: "move",
            margin: "-8px -8px 12px -8px",
            padding: "8px 8px 0 8px",
            userSelect: "none",
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 4 }}>ShopList layout</h2>
          <p
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 12,
              opacity: 0.7,
            }}
          >
            Configure columns and rows per column for each floor. You can also
            override the row count for each column individually. Changes are
            previewed on the main screen in real time. Click Save to apply
            permanently.
          </p>
        </div>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  textAlign: "left",
                  padding: "4px 8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Floor
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "4px 8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Columns
              </th>
              <th
                style={{
                  textAlign: "right",
                  padding: "4px 8px",
                  borderBottom: "1px solid #ddd",
                }}
              >
                Rows / column (default)
              </th>
            </tr>
          </thead>
          <tbody>
            {floors.map((floor) => {
              const perFloor = layout[floor];
              const cols = perFloor?.columns ?? 0;
              const perColumnRows = perFloor?.perColumnRows || [];

              return (
                <React.Fragment key={floor}>
                  <tr>
                    <td style={{ padding: "4px 8px" }}>{floor}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={perFloor?.columns ?? ""}
                        onChange={(e) =>
                          handleChange(floor, "columns", e.target.value)
                        }
                        style={{ width: 70, textAlign: "right" }}
                      />
                    </td>
                    <td style={{ padding: "4px 8px", textAlign: "right" }}>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={perFloor?.rowsPerCol ?? ""}
                        onChange={(e) =>
                          handleChange(floor, "rowsPerCol", e.target.value)
                        }
                        style={{ width: 70, textAlign: "right" }}
                      />
                    </td>
                  </tr>

                  {cols > 0 && (
                    <tr>
                      <td />
                      <td colSpan={2} style={{ padding: "4px 8px" }}>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          {Array.from({ length: cols }).map((_, idx) => (
                            <label
                              key={idx}
                              style={{
                                fontSize: 11,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span>Col {idx + 1}</span>
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
                                style={{ width: 60, textAlign: "right" }}
                              />
                            </label>
                          ))}
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.7,
                            marginTop: 4,
                          }}
                        >
                          Leave empty to use the default rows / column value
                          above.
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 16,
          }}
        >
          <button
            type="button"
            onClick={handleCancelClick}
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid #ccc",
              backgroundColor: "#f5f5f5",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveClick}
            disabled={saving}
            style={{
              padding: "8px 20px",
              borderRadius: 999,
              border: "none",
              background: "linear-gradient(135deg, #007aff, #00c6ff)",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloorLayoutSettingsScreen;
