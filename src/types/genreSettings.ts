export interface GenreDisplayConfig {
  labelEn: string;
  headerTextColor: string;
  headerBorderColor: string;
  rowBackgroundColor: string; // rgba(...) or hex
}

export interface GenreMemoSettings {
  maxDisplayItems: number;
  excludedKeywords: string[];
}

export type GenreMappings = Record<string, GenreDisplayConfig>;

export const DEFAULT_GENRE_MEMO_SETTINGS: GenreMemoSettings = {
  maxDisplayItems: 3,
  excludedKeywords: [],
};

export const DEFAULT_GENRE_MAPPINGS: GenreMappings = {
  "ファッション": {
    labelEn: "Fashion",
    headerTextColor: "#00ade4",
    headerBorderColor: "#00ade4",
    rowBackgroundColor: "rgba(193, 235, 246, 0.5)",
  },
  "ファッション雑貨": {
    labelEn: "Fashion Goods",
    headerTextColor: "#40b93c",
    headerBorderColor: "#40b93c",
    rowBackgroundColor: "rgba(182, 226, 142, 0.5)",
  },
  "雑貨": {
    labelEn: "Goods",
    headerTextColor: "#475eb4",
    headerBorderColor: "#475eb4",
    rowBackgroundColor: "rgba(182, 183, 226, 0.5)",
  },
  "飲食店・食品": {
    labelEn: "Food & Beverage",
    headerTextColor: "#f47216",
    headerBorderColor: "#f47216",
    rowBackgroundColor: "rgba(252, 206, 120, 0.5)",
  },
  "サービス": {
    labelEn: "Services",
    headerTextColor: "#ef2f5a",
    headerBorderColor: "#ef2f5a",
    rowBackgroundColor: "rgba(248, 164, 171, 0.5)",
  },
};

// Color palette for auto-assigning genre display colors
const GENRE_COLOR_PALETTE = [
  { text: "#00ade4", bg: "rgba(193, 235, 246, 0.5)" },
  { text: "#475eb4", bg: "rgba(182, 183, 226, 0.5)" },
  { text: "#40b93c", bg: "rgba(182, 226, 142, 0.5)" },
  { text: "#f47216", bg: "rgba(252, 206, 120, 0.5)" },
  { text: "#ef2f5a", bg: "rgba(248, 164, 171, 0.5)" },
  { text: "#9c27b0", bg: "rgba(224, 185, 235, 0.5)" },
  { text: "#009688", bg: "rgba(178, 223, 219, 0.5)" },
  { text: "#795548", bg: "rgba(215, 204, 200, 0.5)" },
  { text: "#607d8b", bg: "rgba(207, 216, 220, 0.5)" },
];

/** Build GenreMappings from a mall's genreOrder + genreEnglish.
 *  Used as the default when no per-mall settings file exists yet.
 */
export function buildDefaultGenreMappingsForMall(config: {
  genreOrder: string[];
  genreEnglish: Record<string, string>;
}): GenreMappings {
  const result: GenreMappings = {};
  config.genreOrder.forEach((genre, i) => {
    const color = GENRE_COLOR_PALETTE[i % GENRE_COLOR_PALETTE.length];
    result[genre] = {
      labelEn: config.genreEnglish[genre] ?? "",
      headerTextColor: color.text,
      headerBorderColor: color.text,
      rowBackgroundColor: color.bg,
    };
  });
  return result;
}

// Default fallback for new genres
export const DEFAULT_GENRE_CONFIG: GenreDisplayConfig = {
  labelEn: "",
  headerTextColor: "#ffffff",
  headerBorderColor: "#ffffff",
  rowBackgroundColor: "rgba(255, 255, 255, 0.1)",
};
