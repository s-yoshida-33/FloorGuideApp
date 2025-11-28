export type FloorId = "1F" | "2F" | "3F" | "4F";

export type ColumnPadding = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type FloorLayoutPerFloor = {
  columns: number;
  rowsPerCol: number;
  perColumnRows?: number[];
  perColumnPadding?: ColumnPadding[];
};

export type FloorLayout = Record<string, FloorLayoutPerFloor>;

