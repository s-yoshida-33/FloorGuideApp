// src/components/ShopList.tsx
import React from "react";

export interface RawShop {
  shop_id?: string;
  shop_name: string;
  genre: string;       // ex) "ファッション"
  genre_memo: string;  // ex) "レディース"
  number: string;      // ex) "103"
  floor: string;       // ex) "1F"
}

interface Props {
  shops: RawShop[];
  floor: string;       // ex) "1F"
}

// fixed genre order (we will gradually add)
const GENRE_FASHION = "ファッション";
const GENRE_FASHION_GOODS = "ファッション雑貨";

const ROWS_PER_COLUMN = 20; // 1 column = 20 rows (for 4K, 800px height / ~20px font)

/** normalize "1Ｆ", "1階" etc → "1F" */
function normalizeFloor(value: string): string {
  if (!value) return "";
  const m = value.match(/(\d+)/);
  return m ? `${m[1]}F` : value;
}

/** sort by number asc (e.g. "103" < "110" < "112") */
function sortByNumberAsc(a: RawShop, b: RawShop): number {
  return (a.number || "").localeCompare(b.number || "", "ja", {
    numeric: true,
    sensitivity: "base",
  });
}

/** split flat list into columns, each with at most rowsPerColumn rows */
function splitByRows<T>(items: T[], rowsPerColumn: number, maxColumns: number): T[][] {
  if (items.length === 0) return [];
  const colCount = Math.min(maxColumns, Math.max(1, Math.ceil(items.length / rowsPerColumn)));
  const cols: T[][] = [];
  for (let i = 0; i < colCount; i++) {
    const start = i * rowsPerColumn;
    const end = start + rowsPerColumn;
    cols.push(items.slice(start, end));
  }
  return cols;
}

const ShopList: React.FC<Props> = ({ shops, floor }) => {
  const targetFloor = normalizeFloor(floor);

  // ----- filter by floor -----
  const floorShops = shops.filter(
    (s) => normalizeFloor(s.floor) === targetFloor
  );

  // ----- per-genre lists -----
  const fashion = floorShops
    .filter((s) => s.genre === GENRE_FASHION)
    .sort(sortByNumberAsc);

  const fashionGoods = floorShops
    .filter((s) => s.genre === GENRE_FASHION_GOODS)
    .sort(sortByNumberAsc);

  // columns: 20 rows per column, max 3 columns
  const fashionColumns = splitByRows(fashion, ROWS_PER_COLUMN, 3);
  const fashionGoodsColumns = splitByRows(fashionGoods, ROWS_PER_COLUMN, 3);

  return (
    <div
      style={{
        padding: "16px 32px",
        boxSizing: "border-box",
        width: "100%",
        height: "100%",
        fontSize: "20px",       // about 20px on 4K
        lineHeight: 1.4,        // ~28px line height → 20行で約560px
        overflow: "hidden",     // no scroll
      }}
    >
      {/* --- Fashion section --- */}
      {fashion.length > 0 && (
        <section style={{ marginBottom: "24px" }}>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            ファッション
          </div>

          <div
            style={{
              display: "flex",
              gap: "40px",
              alignItems: "flex-start",
            }}
          >
            {fashionColumns.map((col, colIdx) => (
              <div key={colIdx} style={{ minWidth: 0 }}>
                {col.map((s) => (
                  <div
                    key={`${s.number}-${s.shop_name}`}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {s.number}　{s.genre_memo}　{s.shop_name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Fashion goods section --- */}
      {fashionGoods.length > 0 && (
        <section>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            ファッション雑貨
          </div>

          <div
            style={{
              display: "flex",
              gap: "40px",
              alignItems: "flex-start",
            }}
          >
            {fashionGoodsColumns.map((col, colIdx) => (
              <div key={colIdx} style={{ minWidth: 0 }}>
                {col.map((s) => (
                  <div
                    key={`${s.number}-${s.shop_name}`}
                    style={{ whiteSpace: "nowrap" }}
                  >
                    {s.number}　{s.genre_memo}　{s.shop_name}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default ShopList;
