// Global app configuration (English-only comments)
export const APP_CONFIG = {
    baseUrl: "http://localhost:8080",
    floor: "1F",
  
    // 800 / 2160 ≒ 37.037% height for the bottom area (ratio, not px)
    listHeightVh: (800 / 2160) * 100,
  
    // Section column policy (per-genre)
    maxColumns: 3,          // hard cap
    minColumns: 2,          // ensure at least 2 like the reference
    approxRowsPerCol: 20,   // target rows per column
  
    // Row display policy
    showGenreMemo: false,   // image-like: only number + name
    numberColWidthVmin: 6,  // width of number badge
    fontSizeVmin: 1.0,      // base text scale
  };
  