export const FONT_SORT_MODES = ["smart", "name", "custom"] as const;
export type FontSortMode = typeof FONT_SORT_MODES[number];

export const FONT_SORT_FIELDS = ["fontName", "fileName"] as const;
export type FontSortField = typeof FONT_SORT_FIELDS[number];

export const FONT_SORT_ORDERS = ["asc", "desc"] as const;
export type FontSortOrder = typeof FONT_SORT_ORDERS[number];

export const FONT_SORT_BLOCKS = [
  "favorites",
  "activated",
  "deactivated",
  "unplugged",
] as const;
export type FontSortBlock = typeof FONT_SORT_BLOCKS[number];

export interface FontSortSettings {
  mode: FontSortMode;
  nameField: FontSortField;
  nameOrder: FontSortOrder;
  customPriority: FontSortBlock[];
  customField: FontSortField;
  customOrder: FontSortOrder;
}

export const DEFAULT_SORT_BLOCK_ORDER: FontSortBlock[] = [...FONT_SORT_BLOCKS];

export const DEFAULT_SORT_SETTINGS: FontSortSettings = {
  mode: "smart",
  nameField: "fontName",
  nameOrder: "asc",
  customPriority: [...DEFAULT_SORT_BLOCK_ORDER],
  customField: "fontName",
  customOrder: "asc",
};
