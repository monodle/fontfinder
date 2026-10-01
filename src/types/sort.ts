export type FontSortMode = "smart" | "name" | "custom";
export type FontSortField = "fontName" | "fileName";
export type FontSortOrder = "asc" | "desc";
export type FontSortBlock = "favorites" | "activated" | "deactivated" | "unplugged";

export interface FontSortSettings {
  mode: FontSortMode;
  nameField: FontSortField;
  nameOrder: FontSortOrder;
  customPriority: FontSortBlock[];
  customField: FontSortField;
  customOrder: FontSortOrder;
}

export const DEFAULT_SORT_BLOCK_ORDER: FontSortBlock[] = [
  "favorites",
  "activated",
  "deactivated",
  "unplugged",
];

export const DEFAULT_SORT_SETTINGS: FontSortSettings = {
  mode: "smart",
  nameField: "fontName",
  nameOrder: "asc",
  customPriority: [...DEFAULT_SORT_BLOCK_ORDER],
  customField: "fontName",
  customOrder: "asc",
};
