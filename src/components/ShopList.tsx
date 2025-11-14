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

// Build column sections (genre + shops) from line sequence
function buildSectionsForColumn(lines: Line[]): { genre: string; shops: Shop[] }[] {
  const sections: { genre: string; shops: Shop[] }[] = [];
  let current: { genre: string; shops: Shop[] } | null = null;

  for (const line of lines) {
    if (line.kind === "header") {
      if (current && current.shops.length > 0) {
        sections.push(current);
      }
      current = { genre: line.genre, shops: [] };
    } else {
      if (!current || current.genre !== line.genre) {
        current = { genre: line.genre, shops: [] };
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
  // 1) Filter by floor
  const normalizedFloor = normalizeFloor(floor);
  const floorShops = shops.filter(
    (s) => normalizeFloor(s.floor) === normalizedFloor
  );

  // 2) Build ordered line list (genre header + shops)
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

  // 3) Split lines into columns with max row count
  const rowsPerColumn = APP_CONFIG.approxRowsPerCol;
  const maxColumns = APP_CONFIG.maxColumns;

  const columns: Line[][] = [[]];
  let currentColIndex = 0;
  let currentRows = 0;

  const startNewColumn = (continuationGenre?: string) => {
    if (currentColIndex >= maxColumns - 1) {
      // No more columns available. Everything will overflow in the last column.
      // This is a safety fallback; ideally rowsPerColumn should be tuned
      // so that all lines fit within maxColumns.
      if (continuationGenre) {
        columns[currentColIndex].push({ kind: "header", genre: continuationGenre });
        currentRows += 1;
      }
      return;
    }

    currentColIndex += 1;
    columns[currentColIndex] = [];
    currentRows = 0;

    if (continuationGenre) {
      columns[currentColIndex].push({ kind: "header", genre: continuationGenre });
      currentRows += 1;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineCost = 1;

    // If this line does not fit in current column, move to the next column
    if (currentRows + lineCost > rowsPerColumn && currentRows > 0) {
      if (line.kind === "shop") {
        // When we move to the next column in the middle of a genre,
        // we repeat the genre header at the top of the new column.
        startNewColumn(line.genre);
      } else {
        // Header itself does not fit, just move to next column
        startNewColumn();
      }
    }

    columns[currentColIndex].push(line);
    currentRows += lineCost;
  }

  // Remove empty last column if any
  const nonEmptyColumns = columns.filter((col) => col.length > 0);
  const columnCount = nonEmptyColumns.length || 1;

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
                <section key={`${colIdx}-${section.genre}`} style={{ marginBottom: "24px" }}>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginBottom: "8px",
                    }}
                  >
                    {section.genre}
                  </div>

                  {section.shops.map((s) => (
                    <div
                      key={`${s.number}-${s.name}`}
                      style={{ whiteSpace: "nowrap" }}
                    >
                      {s.number}　{s.genreMemo}　{s.name}
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
