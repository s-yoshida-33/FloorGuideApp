// src/components/ShopList.tsx
import React from "react";
import type { Shop } from "../types/shop";
import {
  APP_CONFIG,
  GENRE_ORDER,
  FLOOR_ROWS_PER_COL,
  FLOOR_COLUMN_COUNT,
} from "../config";
import "../styles/ShopList.css";
import { logError, logDebug } from "../logs/logging";
import { DEFAULT_GENRE_MAPPINGS, type GenreMappings, DEFAULT_GENRE_CONFIG, type GenreMemoSettings, DEFAULT_GENRE_MEMO_SETTINGS } from "../types/genreSettings";
import type { ShopSettings } from "../types/shopSettings";

type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

interface ShopListProps {
  shops: Shop[];
  floor: string;
  columnCount?: number;
  rowsPerColumn?: number;
  perColumnRows?: number[]; // Column-by-column row overrides
  perColumnPadding?: ColumnPadding[]; // Column-by-column padding
  genreMappings?: GenreMappings;
  genreMemoSettings?: GenreMemoSettings;
  shopSettings?: ShopSettings;
}

// Internal representation of a single line item (header or shop row)
type Line =
  | { kind: "header"; genre: string }
  | { kind: "shop"; genre: string; shop: Shop };

// A group of lines that belong to the same column and genre
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

// Build grouped sections (genre + shops) from a list of sequential lines
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

// Compare shop numbers numerically (ascending)
function compareShopNumberAsc(a: Shop, b: Shop): number {
  return (a.number || "").localeCompare(b.number || "", "ja", {
    numeric: true,
    sensitivity: "base",
  });
}

// ----- Main Component --------------------------------------------------------
const ShopList: React.FC<ShopListProps> = ({
  shops,
  floor,
  columnCount,
  rowsPerColumn,
  perColumnRows,
  perColumnPadding,
  genreMappings = DEFAULT_GENRE_MAPPINGS,
  genreMemoSettings = DEFAULT_GENRE_MEMO_SETTINGS,
  shopSettings,
}) => {
  const normalizedFloor = normalizeFloor(floor);

  // ---------------------------------------------------------------------------
  // Floor filtering (supports floors: FloorId[] + legacy floor/floors string)
  // ---------------------------------------------------------------------------
  const floorShops = shops.filter((s) => {
    const tokens: string[] = [];

    // 1) Official field: floors: FloorId[]
    if (Array.isArray(s.floors)) {
      s.floors.forEach((value) => {
        String(value)
          .split(/[、,・/]/)
          .forEach((raw) => {
            const v = raw.trim();
            if (v.length > 0) tokens.push(v);
          });
      });
    }

    // 2) Legacy compatibility: floor or floors as a string
    if (tokens.length === 0) {
      const legacy: unknown = (s as any).floors ?? (s as any).floor;
      if (typeof legacy === "string" && legacy.trim().length > 0) {
        legacy
          .split(/[、,・/]/)
          .map((v) => v.trim())
          .filter((v) => v.length > 0)
          .forEach((v) => tokens.push(v));
      }
    }

    if (tokens.length === 0) return false;

    const normalizedTokens = tokens.map((v) => normalizeFloor(v));
    return normalizedTokens.includes(normalizedFloor);
  });

  // ---------------------------------------------------------------------------
  // Normal layout rendering (wrapped in try/catch for fallback safety)
  // ---------------------------------------------------------------------------
  const renderNormalLayout = () => {
    // Build list of ordered lines (genre headers + shop rows)
    const lines: Line[] = [];

    // Determine the order: use keys from genreMappings first, then fallback to GENRE_ORDER
    const configuredOrder = Object.keys(genreMappings);
    // If configuredOrder is empty (e.g. initial load before settings), fallback to GENRE_ORDER
    const primaryOrder = configuredOrder.length > 0 ? configuredOrder : GENRE_ORDER;

    for (const genre of primaryOrder) {
      const list = floorShops
        .filter((s) => s.genre === genre)
        .sort(compareShopNumberAsc);

      if (list.length === 0) continue;

      lines.push({ kind: "header", genre });

      for (const shop of list) {
        lines.push({ kind: "shop", genre, shop });
      }
    }

    // Add genres not included in primary order
    const knownSet = new Set(primaryOrder);
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

    // Determine effective column count
    const maxColumns = APP_CONFIG.maxColumns;
    const defaultColumns = FLOOR_COLUMN_COUNT[normalizedFloor] ?? 1;
    const defaultRowsPerCol = FLOOR_ROWS_PER_COL[normalizedFloor];

    const effectiveColumns = (() => {
      const base = columnCount ?? defaultColumns;
      const safe = base > 0 ? base : 1;
      return Math.min(maxColumns, safe);
    })();

    // Determine base rows per column
    const baseRowsPerCol = (() => {
      if (rowsPerColumn && rowsPerColumn > 0) return rowsPerColumn;
      if (defaultRowsPerCol && defaultRowsPerCol > 0) return defaultRowsPerCol;
      const auto = Math.ceil(totalLines / effectiveColumns);
      return auto > 0 ? auto : 1;
    })();

    const perColumnOverrides: number[] = perColumnRows ?? [];

    // Build row capacities for each column
    const capacities: number[] = Array.from(
      { length: effectiveColumns },
      (_: unknown, idx: number) => {
        const override = perColumnOverrides[idx];
        if (typeof override === "number" && override > 0) return override;
        return baseRowsPerCol;
      }
    );

    // Split lines into columns with capacity constraints
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

    // Logging
    if (floorShops.length > 0) {
      // Use debug level to avoid flooding logs on re-renders
      logDebug("shopList", "ShopList rendered", {
        floor: normalizedFloor,
        floorShopsCount: floorShops.length,
        totalLines,
        columnCount: effectiveColumns,
        baseRowsPerCol,
        capacities,
        nonEmptyColumnCount: nonEmptyColumns.length,
      });
    }

    // Render columns
    return (
      <div
        style={{
          display: "flex",
          gap: "20px",
          alignItems: "flex-start",
          height: "100%",
          backgroundColor: "fff",
        }}
      >
        {nonEmptyColumns.map((colLines, colIdx) => {
          const sections = buildSectionsForColumn(colLines);
          const padding = perColumnPadding?.[colIdx];
          const paddingStyle = padding
            ? {
                paddingTop: padding.top !== undefined ? `${padding.top}em` : undefined,
                paddingRight: padding.right !== undefined ? `${padding.right}em` : undefined,
                paddingBottom: padding.bottom !== undefined ? `${padding.bottom}em` : undefined,
                paddingLeft: padding.left !== undefined ? `${padding.left}em` : undefined,
              }
            : {};

          return (
            <div
              key={colIdx}
              style={{
                flex: 1,
                minWidth: 0,
                ...paddingStyle,
              }}
            >
              {sections.map((section) => {
                const config = genreMappings[section.genre] || DEFAULT_GENRE_CONFIG;
                // Inject CSS variables for this section's genre colors
                const sectionStyle = {
                  "--genre-color-text": config.headerTextColor,
                  "--genre-color-border": config.headerBorderColor,
                  "--genre-color-row": config.rowBackgroundColor,
                  marginBottom: "10px",
                } as React.CSSProperties;

                return (
                  <section
                    key={`${colIdx}-${section.genre}-${section.showHeader ? "h" : "c"}`}
                    style={sectionStyle}
                  >
                    {/* Genre Header */}
                    {section.showHeader && (
                      <div
                        className="shoplist-genre-header"
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-end",
                          fontSize: "1.2em",
                          fontWeight: 700,
                          marginBottom: "8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span>{section.genre}</span>
                        <span style={{ fontSize: "0.7em" }}>
                          {config.labelEn ?? ""}
                        </span>
                      </div>
                    )}

                    {/* Shop rows */}
                    {section.shops.map((s, idx) => {
                      const shopConfig =
                        s.shopId && shopSettings && typeof shopSettings === 'object' ? shopSettings[s.shopId] : undefined;
                      const maxItems = shopConfig?.genreMemoMaxItems ?? genreMemoSettings?.maxDisplayItems;
                      
                      let displayMemo = s.genreMemo;
                      if (displayMemo) {
                        const parts = displayMemo.split(/[、,，・/／\s　|｜]+/);
                        // Trim parts and filter out empty strings and excluded keywords
                        const excludedKeywords = genreMemoSettings?.excludedKeywords || [];
                        const nonEmptyParts = parts
                            .map(p => p.trim())
                            .filter(p => p.length > 0 && !excludedKeywords.includes(p));
                        
                        const partsToDisplay = (maxItems !== undefined && maxItems > 0)
                          ? nonEmptyParts.slice(0, maxItems)
                          : nonEmptyParts;

                        displayMemo = partsToDisplay.join("・");
                      }

                      const rowClassNames = [
                        "shoplist-row",
                        idx === 0 && "shoplist-row-first",
                        idx % 2 === 0 && "shoplist-row-striped",
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

                            {displayMemo && (
                              <span
                                style={{
                                  marginLeft: "0.5em",
                                  fontFamily: "Rounded Mplus 1c, sans-serif",
                                  fontWeight: 400,
                                  fontSize: "0.7em",
                                }}
                              >
                                {`[${displayMemo}]`}
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
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Fallback rendering (shown if any unexpected error occurs above)
  // ---------------------------------------------------------------------------
  let content: React.ReactNode;

  try {
    content = renderNormalLayout();
  } catch (error) {
    logError("shopList", "ShopList render failed, using fallback layout", {
      floor: normalizedFloor,
      error: String(error),
    });

    content = (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          height: "100%",
          overflow: "hidden",
        }}
      >
        {floorShops.map((s) => {
          // const config = genreMappings[s.genre] || DEFAULT_GENRE_CONFIG;
          const shopConfig =
            s.shopId && shopSettings && typeof shopSettings === 'object' ? shopSettings[s.shopId] : undefined;
          const maxItems = shopConfig?.genreMemoMaxItems ?? genreMemoSettings?.maxDisplayItems;
          
          let displayMemo = s.genreMemo;
          if (displayMemo) {
            const parts = displayMemo.split(/[、,，・/／\s　|｜]+/);
            // Trim parts and filter out empty strings and excluded keywords
            const excludedKeywords = genreMemoSettings?.excludedKeywords || [];
            const nonEmptyParts = parts
                .map(p => p.trim())
                .filter(p => p.length > 0 && !excludedKeywords.includes(p));
            
            const partsToDisplay = (maxItems !== undefined && maxItems > 0)
              ? nonEmptyParts.slice(0, maxItems)
              : nonEmptyParts;

            displayMemo = partsToDisplay.join("・");
          }

          return (
            <div
              key={`${s.number}-${s.name}`}
            style={{
              display: "flex",
              justifyContent: "space-between",
              whiteSpace: "nowrap",
            }}
          >
            <span>
              <span
                style={{
                  display: "inline-block",
                  width: "4em",
                  textAlign: "left",
                }}
              >
                {s.number}
              </span>
              {displayMemo && (
                <span
                  style={{
                    marginLeft: "0.5em",
                    fontFamily: "Rounded Mplus 1c, sans-serif",
                    fontWeight: 400,
                    fontSize: "0.7em",
                  }}
                >
                  {`[${displayMemo}]`}
                </span>
              )}
            </span>
            <span>{s.name}</span>
          </div>
          );
        })}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Outer layout wrapper
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        padding: "10px 16px",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        fontSize: `${APP_CONFIG.fontSizeVmin}vmin`,
        lineHeight: 1.4,
        overflow: "hidden",
        fontWeight: 700,
        backgroundColor: "#ffffff",
      }}
    >
      {content}
    </div>
  );
};

export default ShopList;
