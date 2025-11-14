// src/components/ShopList.tsx
import React from "react";
import type { Shop } from "../types/shop";
import { APP_CONFIG, GENRE_ORDER } from "../config";

interface ShopListProps {
  shops: Shop[];
  floor: string;
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

const ShopList: React.FC<ShopListProps> = ({ shops, floor }) => {
  // ---------------------------------------------------------------------------
  // 1) Filter by floor
  // ---------------------------------------------------------------------------
  const normalizedFloor = normalizeFloor(floor);
  const floorShops = shops.filter(
    (s) => normalizeFloor(s.floor) === normalizedFloor
  );

  // ---------------------------------------------------------------------------
  // 2) Build ordered line list (genre header + shops, in fixed genre order)
  // ---------------------------------------------------------------------------
  const lines: Line[] = [];

  // Known genres in fixed order
  for (const genre of GENRE_ORDER) {
    const list = floorShops
      .filter((s) => s.genre === genre)
      .sort(compareShopNumberAsc);

    if (list.length === 0) continue;

    // Header
    lines.push({ kind: "header", genre });

    // Shops
    for (const shop of list) {
      lines.push({ kind: "shop", genre, shop });
    }
  }

  // Optional: handle genres not in GENRE_ORDER at the end
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
  // 3) Decide column count and rows per column
  // ---------------------------------------------------------------------------
  const approxRows = APP_CONFIG.approxRowsPerCol;
  const maxColumns = APP_CONFIG.maxColumns;

  let columnCount = 1;
  if (totalLines === 0) {
    columnCount = 1;
  } else {
    const estimatedCols = Math.ceil(totalLines / approxRows);
    columnCount = Math.min(maxColumns, Math.max(1, estimatedCols));
  }

  const rowsPerColumn =
    columnCount > 0 ? Math.ceil(totalLines / columnCount) : totalLines;

  // ---------------------------------------------------------------------------
  // 4) Split lines into columns, allowing breaks inside genres
  //
  //    - We walk lines from top to bottom.
  //    - When the current column reaches rowsPerColumn, we move to next column.
  //    - If we move to the next column in the middle of a genre, we DO NOT
  //      repeat the genre header. The new column starts with shop lines only.
  // ---------------------------------------------------------------------------
  const columns: Line[][] = Array.from({ length: columnCount }, () => []);
  let currentColIndex = 0;
  let currentRows = 0;

  const startNewColumn = () => {
    if (currentColIndex >= columnCount - 1) {
      // No more columns available, append everything to the last column
      // (this is a safety fallback; ideally approxRowsPerCol should be tuned).
      return;
    }
    currentColIndex += 1;
    currentRows = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineCost = 1;

    if (currentRows + lineCost > rowsPerColumn && currentRows > 0) {
      // Move to next column; do NOT add header again
      startNewColumn();
    }

    columns[currentColIndex].push(line);
    currentRows += lineCost;
  }

  const nonEmptyColumns = columns.filter((col) => col.length > 0);

  // ---------------------------------------------------------------------------
  // 5) Render columns
  // ---------------------------------------------------------------------------
  return (
    <div
      style={{
        padding: "16px 32px",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        fontSize: `${APP_CONFIG.fontSizeVmin}vmin`,
        lineHeight: 1.4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "40px",
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
                  key={`${colIdx}-${section.genre}-${section.showHeader ? "h" : "c"}`}
                  style={{ marginBottom: "24px" }}
                >
                  {section.showHeader && (
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "8px",
                      }}
                    >
                      {section.genre}
                    </div>
                  )}

                  {section.shops.map((s) => (
                    <div
                      key={`${s.number}-${s.name}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        whiteSpace: "nowrap",
                        width: "100%",
                      }}
                    >
                      <span>{s.genreMemo ? `${s.number}　${s.genreMemo}` : `${s.number}`}</span>
                      <span style={{ marginLeft: "12px" }}>{s.name}</span>
                    </div>
                  ))}
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
