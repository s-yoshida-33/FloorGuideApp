// src/components/ShopList.tsx
import React, { useEffect } from "react";
import type { Shop } from "../types/shop";
import {
  APP_CONFIG,
  GENRE_ORDER,
  GENRE_ENGLISH,
  FLOOR_ROWS_PER_COL,
  FLOOR_COLUMN_COUNT,
} from "../config";
import "../styles/ShopList.css";
import { logInfo } from "../logging";

interface ShopListProps {
  shops: Shop[];
  floor: string;
  columnCount?: number;
  rowsPerColumn?: number;
  perColumnRows?: number[];
}

// Internal line representation for layout
type Line =
  | { kind: "header"; genre: string }
  | { kind: "shop"; genre: string; shop: Shop };

// Section inside a single column
interface ColumnSection {
  genre: string;
  shops: Shop[];
  showHeader: boolean;
}

// Normalize floor strings such as "1Ｆ", "1階" to "1F"
function normalizeFloor(value: string): string {
  if (!value) return "";
  const m = value.match(/(\d+)/);
  return m ? `${m[1]}F` : value;
}

// Compare shops by number in ascending order
function compareShopNumberAsc(a: Shop, b: Shop): number {
  return (a.number || "").localeCompare(b.number || "", "ja", {
    numeric: true,
    sensitivity: "base",
  });
}

// Build column sections (genre + shops) from line sequence.
// showHeader is true only if this column actually contains a header line.
function buildSectionsForColumn(lines: Line[]): ColumnSection[] {
  const sections: ColumnSection[] = [];
  let current: ColumnSection | null = null;

  for (const line of lines) {
    if (line.kind === "header") {
      if (current && current.shops.length > 0) {
        sections.push(current);
      }
      current = { genre: line.genre, shops: [], showHeader: true };
    } else {
      if (!current || current.genre !== line.genre) {
        // This happens when the column starts in the middle of a genre
        // and there was no header line in this column.
        if (current && current.shops.length > 0) {
          sections.push(current);
        }
        current = { genre: line.genre, shops: [], showHeader: false };
      }
      current.shops.push(line.shop);
    }
  }

  if (current && current.shops.length > 0) {
    sections.push(current);
  }

  return sections;
}

const ShopList: React.FC<ShopListProps> = ({
  shops,
  floor,
  columnCount,
  rowsPerColumn,
  perColumnRows,
}) => {
  // ---------------------------------------------------------------------------
  // 1) Filter by floor
  // ---------------------------------------------------------------------------
  const normalizedFloor = normalizeFloor(floor);

  // Support both `floor` and `floors` property names.
  // If either is missing or empty, the shop is excluded.
  const floorShops = shops.filter((s) => {
    const anyShop = s as any;

    const raw = anyShop.floor ?? anyShop.floors ?? "";
    if (!raw) return false;

    const normalized = normalizeFloor(String(raw));

    return normalized === normalizedFloor;
  });

  // ---------------------------------------------------------------------------
  // 2) Build ordered line list (genre header + shops, in fixed genre order)
  // ---------------------------------------------------------------------------
  const lines: Line[] = [];

  for (const genre of GENRE_ORDER) {
    const list = floorShops
      .filter((s) => s.genre === genre)
      .sort(compareShopNumberAsc);

    if (list.length === 0) continue;

    lines.push({ kind: "header", genre });

    for (const shop of list) {
      lines.push({ kind: "shop", genre, shop });
    }
  }

  const knownSet = new Set(GENRE_ORDER);
  const otherGenres = Array.from(
    new Set(
      floorShops
        .map((s) => s.genre)
        .filter((g) => g && !knownSet.has(g))
    )
  );

  for (const genre of otherGenres) {
    const list = floorShops
      .filter((s) => s.genre === genre)
      .sort(compareShopNumberAsc);

    if (list.length === 0) continue;

    lines.push({ kind: "header", genre });

    for (const shop of list) {
      lines.push({ kind: "shop", genre, shop });
    }
  }

  const totalLines = lines.length;

  // ---------------------------------------------------------------------------
  // 3) Decide column count and rows per column (with per-column overrides)
  // ---------------------------------------------------------------------------
  const maxColumns = APP_CONFIG.maxColumns;

  const defaultColumns = FLOOR_COLUMN_COUNT[normalizedFloor] ?? 1;
  const defaultRowsPerCol = FLOOR_ROWS_PER_COL[normalizedFloor];

  const effectiveColumns = (() => {
    const base = columnCount ?? defaultColumns;
    const safe = base > 0 ? base : 1;
    return Math.min(maxColumns, safe);
  })();

  const baseRowsPerCol = (() => {
    if (rowsPerColumn && rowsPerColumn > 0) {
      return rowsPerColumn;
    }
    if (defaultRowsPerCol && defaultRowsPerCol > 0) {
      return defaultRowsPerCol;
    }
    const auto = Math.ceil(totalLines / effectiveColumns);
    return auto > 0 ? auto : 1;
  })();

  const perColumnOverrides = perColumnRows ?? [];

  // Capacity for each column: per-column override or baseRowsPerCol
  const capacities: number[] = Array.from(
    { length: effectiveColumns },
    (_, idx) => {
      const override = perColumnOverrides[idx];
      if (typeof override === "number" && override > 0) {
        return override;
      }
      return baseRowsPerCol;
    }
  );

  // ---------------------------------------------------------------------------
  // 4) Split lines into columns, preventing orphan headers
  // ---------------------------------------------------------------------------
  const columns: Line[][] = Array.from(
    { length: effectiveColumns },
    () => []
  );
  let currentColIndex = 0;
  let currentRows = 0;

  const startNewColumn = () => {
    if (currentColIndex >= effectiveColumns - 1) return;
    currentColIndex += 1;
    currentRows = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const capacity = capacities[currentColIndex];

    if (line.kind === "header") {
      const next = lines[i + 1];
      const needsTwoRows =
        next && next.kind === "shop" && next.genre === line.genre;
      const required = needsTwoRows ? 2 : 1;

      if (currentRows > 0 && currentRows + required > capacity) {
        startNewColumn();
      }
    } else {
      if (currentRows > 0 && currentRows + 1 > capacity) {
        startNewColumn();
      }
    }

    columns[currentColIndex].push(line);
    currentRows += 1;
  }

  const nonEmptyColumns = columns.filter((col) => col.length > 0);

  // ---------------------------------------------------------------------------
  // 4.5) Logging
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (shops.length === 0) {
      logInfo("shopList", "ShopList rendered with empty shops array", {
        floor: normalizedFloor,
      });
      return;
    }

    if (floorShops.length === 0) {
      logInfo("shopList", "ShopList rendered with no shops for floor", {
        floor: normalizedFloor,
      });
      return;
    }

    logInfo("shopList", "ShopList rendered", {
      floor: normalizedFloor,
      floorShopsCount: floorShops.length,
      totalLines,
      columnCount: effectiveColumns,
      baseRowsPerCol,
      capacities,
      nonEmptyColumnCount: nonEmptyColumns.length,
    });
  }, [
    normalizedFloor,
    shops.length,
    floorShops.length,
    totalLines,
    effectiveColumns,
    baseRowsPerCol,
    nonEmptyColumns.length,
    capacities.join(","),
  ]);

  // ---------------------------------------------------------------------------
  // 5) Render columns
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        padding: "18px 16px",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        fontSize: `${APP_CONFIG.fontSizeVmin}vmin`,
        lineHeight: 1.4,
        overflow: "hidden",
        fontWeight: 700,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
          height: "100%",
        }}
      >
        {nonEmptyColumns.map((colLines, colIdx) => {
          const sections = buildSectionsForColumn(colLines);

          return (
            <div key={colIdx} style={{ flex: 1, minWidth: 0 }}>
              {sections.map((section) => (
                <section
                  key={`${colIdx}-${section.genre}-${
                    section.showHeader ? "h" : "c"
                  }`}
                  style={{ marginBottom: "10px" }}
                >
                  {section.showHeader &&
                    (() => {
                      const isFashion = section.genre === "ファッション";
                      const isFashionGoods =
                        section.genre === "ファッション雑貨";
                      const isGoods = section.genre === "雑貨";
                      const isFood = section.genre === "飲食店・食品";
                      const isService = section.genre === "サービス";

                      const headerClassNames = [
                        (isFashion ||
                          isFashionGoods ||
                          isGoods ||
                          isFood ||
                          isService) && "shoplist-genre-header",
                        isFashion && "shoplist-genre-header--fashion",
                        isFashionGoods &&
                          "shoplist-genre-header--fashion-goods",
                        isGoods && "shoplist-genre-header--goods",
                        isFood && "shoplist-genre-header--food",
                        isService && "shoplist-genre-header--service",
                      ]
                        .filter(Boolean)
                        .join(" ");

                      return (
                        <div
                          className={headerClassNames}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "flex-end",
                            fontSize: "1.4em",
                            fontWeight: 700,
                            marginBottom: "8px",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <span>{section.genre}</span>
                          <span style={{ fontSize: "0.7em" }}>
                            {GENRE_ENGLISH[section.genre] ?? ""}
                          </span>
                        </div>
                      );
                    })()}

                  {section.shops.map((s, idx) => {
                    const isFashion = section.genre === "ファッション";
                    const isFashionGoods =
                      section.genre === "ファッション雑貨";
                    const isGoods = section.genre === "雑貨";
                    const isFood = section.genre === "飲食店・食品";
                    const isService = section.genre === "サービス";

                    const rowClassNames = [
                      (isFashion ||
                        isFashionGoods ||
                        isGoods ||
                        isFood ||
                        isService) && "shoplist-row",
                      (isFashion ||
                        isFashionGoods ||
                        isGoods ||
                        isFood ||
                        isService) &&
                        idx === 0 &&
                        "shoplist-row-first",
                      isFashion &&
                        idx % 2 === 0 &&
                        "shoplist-row--fashion-striped",
                      isFashionGoods &&
                        idx % 2 === 0 &&
                        "shoplist-row--fashion-goods-striped",
                      isGoods &&
                        idx % 2 === 0 &&
                        "shoplist-row--goods-striped",
                      isFood && idx % 2 === 0 && "shoplist-row--food-striped",
                      isService &&
                        idx % 2 === 0 &&
                        "shoplist-row--service-striped",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <div
                        key={`${s.number}-${s.name}`}
                        className={rowClassNames}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          whiteSpace: "nowrap",
                          width: "100%",
                        }}
                      >
                        <span
                          style={{
                            marginLeft: "0.5em",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <span
                            style={{
                              display: "inline-block",
                              width: "4em",
                              textAlign: "left",
                            }}
                          >
                            {s.number}
                          </span>

                          {s.genreMemo && (
                            <span
                              style={{
                                marginLeft: "0.5em",
                                fontFamily:
                                  "Rounded Mplus 1c, sans-serif",
                                fontWeight: 400,
                                fontSize: "0.7em",
                              }}
                            >
                              {s.genreMemo ? `[${s.genreMemo}]` : ""}
                            </span>
                          )}
                        </span>

                        <span
                          style={{
                            marginLeft: "12px",
                            marginRight: "0.5em",
                          }}
                        >
                          {s.name}
                        </span>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ShopList;
