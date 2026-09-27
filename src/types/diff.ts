import { FontMetadata } from "./font";

export interface DiffSlotConfig {
  index: number;
  name: string;
  color: string; // Hex color
  bgBadge: string;
  borderBadge: string;
  textBadge: string;
  bgActive: string;
}

export const DIFF_SLOT_CONFIGS: DiffSlotConfig[] = [
  {
    index: 0,
    name: "Slot 1",
    color: "#0284C7", // Sky Blue
    bgBadge: "bg-sky-500/15",
    borderBadge: "border-sky-500/30",
    textBadge: "text-sky-600 dark:text-sky-400",
    bgActive: "border-sky-500 ring-1 ring-sky-500/30 shadow-sky-500/10",
  },
  {
    index: 1,
    name: "Slot 2",
    color: "#EA580C", // Coral Orange
    bgBadge: "bg-orange-500/15",
    borderBadge: "border-orange-500/30",
    textBadge: "text-orange-600 dark:text-orange-400",
    bgActive: "border-orange-500 ring-1 ring-orange-500/30 shadow-orange-500/10",
  },
  {
    index: 2,
    name: "Slot 3",
    color: "#059669", // Emerald Green
    bgBadge: "bg-emerald-500/15",
    borderBadge: "border-emerald-500/30",
    textBadge: "text-emerald-600 dark:text-emerald-400",
    bgActive: "border-emerald-500 ring-1 ring-emerald-500/30 shadow-emerald-500/10",
  },
  {
    index: 3,
    name: "Slot 4",
    color: "#7C3AED", // Violet Purple
    bgBadge: "bg-violet-500/15",
    borderBadge: "border-violet-500/30",
    textBadge: "text-violet-600 dark:text-violet-400",
    bgActive: "border-violet-500 ring-1 ring-violet-500/30 shadow-violet-500/10",
  },
  {
    index: 4,
    name: "Slot 5",
    color: "#E11D48", // Rose Pink
    bgBadge: "bg-rose-500/15",
    borderBadge: "border-rose-500/30",
    textBadge: "text-rose-600 dark:text-rose-400",
    bgActive: "border-rose-500 ring-1 ring-rose-500/30 shadow-rose-500/10",
  },
];

export interface DiffSlotState {
  slotIndex: number;
  font: FontMetadata | null;
  fontFamily: string;
  visible: boolean;
  opacity: number; // 0 ~ 100
  fontSize: number; // px (240 ~ 400)
  offsetX: number; // px
  offsetY: number; // px
  isBold: boolean;
  isItalic: boolean;
  renderMode: "fill" | "stroke";
}

export interface DiffMasterSettings {
  text: string;
  fontSize: number;
  showGrid: boolean;
  showGuidelines?: boolean;
  isBold: boolean;
  isItalic: boolean;
  renderMode: "fill" | "stroke";
}
