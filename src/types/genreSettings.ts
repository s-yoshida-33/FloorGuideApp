export interface GenreDisplayConfig {
  labelEn: string;
  headerTextColor: string;
  headerBorderColor: string;
  rowBackgroundColor: string; // rgba(...) or hex
}

export type GenreMappings = Record<string, GenreDisplayConfig>;

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

// Default fallback for new genres
export const DEFAULT_GENRE_CONFIG: GenreDisplayConfig = {
  labelEn: "",
  headerTextColor: "#ffffff",
  headerBorderColor: "#ffffff",
  rowBackgroundColor: "rgba(255, 255, 255, 0.1)",
};
