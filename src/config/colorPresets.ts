export interface ColorPreset {
  label: string;
  color: string;
}

/**
 * 폰트 색상 프리셋 (20종):
 * 다크 모드용 밝은 텍스트부터 감각적인 빈티지 잉크/미네랄 톤, 딥 잉크 블랙까지
 * 밝은 색상에서 어두운 색상 순(휘도 내림차순)으로 정렬
 */
export const TEXT_COLOR_PRESETS: ColorPreset[] = [
  { label: "Pure White", color: "#ffffff" },
  { label: "Warm Cream", color: "#faf5ec" },
  { label: "Soft Ivory", color: "#f1ede2" },
  { label: "Champagne Silver", color: "#ded7cb" },
  { label: "Pale Slate", color: "#cbd5e1" },
  { label: "Warm Ochre", color: "#c28830" },
  { label: "Sage Green", color: "#6b826b" },
  { label: "Dusty Coral", color: "#a85d56" },
  { label: "Vintage Rose", color: "#9c576a" },
  { label: "Slate Blue", color: "#506f85" },
  { label: "Terracotta", color: "#8e422c" },
  { label: "Antique Umber", color: "#744b34" },
  { label: "Olive Forest", color: "#44553c" },
  { label: "Deep Teal", color: "#224f54" },
  { label: "Plum Wine", color: "#4d2839" },
  { label: "Midnight Navy", color: "#1e3352" },
  { label: "Dark Slate", color: "#252d3a" },
  { label: "Espresso", color: "#2a1e17" },
  { label: "Carbon Charcoal", color: "#1d1f23" },
  { label: "Pure Black", color: "#000000" },
];

/**
 * 배경 색상 프리셋 (20종):
 * 눈이 편안한 페이퍼/밀크/파스텔 북 톤부터 빈티지 크라프트, 몰입형 다크/나이트 톤까지
 * 밝은 색상에서 어두운 색상 순(휘도 내림차순)으로 정렬
 */
export const BG_COLOR_PRESETS: ColorPreset[] = [
  { label: "Pure White", color: "#ffffff" },
  { label: "Warm Milk", color: "#fdfbf7" },
  { label: "Book Cream", color: "#faf6ee" },
  { label: "Blush Mist", color: "#fcf1f3" },
  { label: "Soft Linen", color: "#f5f3ef" },
  { label: "Soft Mint", color: "#edf6f0" },
  { label: "Pale Sky", color: "#edf3f8" },
  { label: "Warm Paper", color: "#f7f1e5" },
  { label: "Pale Lavender", color: "#f3eff7" },
  { label: "Oatmeal Beige", color: "#eee6d8" },
  { label: "Muted Sage", color: "#e1e9e0" },
  { label: "Ash Gray", color: "#d6dadf" },
  { label: "Soft Sand", color: "#ded6c7" },
  { label: "Vintage Kraft", color: "#b8a692" },
  { label: "Muted Olive", color: "#4a5448" },
  { label: "Slate Charcoal", color: "#334155" },
  { label: "Midnight Indigo", color: "#1e293b" },
  { label: "Deep Espresso", color: "#241a15" },
  { label: "Nord Night", color: "#171c24" },
  { label: "OLED Black", color: "#0a0a0a" },
];

/**
 * 색상 밝기를 기반으로 체크마크나 텍스트의 가독성 색상(검정/흰색)을 결정
 */
export function isLightColor(hexColor: string): boolean {
  if (!hexColor || hexColor === "transparent") return true;
  const hex = hexColor.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // YIQ luminance 공식
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 150;
}

export type LibraryPaletteCategory =
  | "warm"
  | "nature"
  | "cool"
  | "purple"
  | "neutral";

export interface LibraryColorPreset extends ColorPreset {
  category: LibraryPaletteCategory;
}

/**
 * 서재(세트, 폴더) 라벨용 200종 다채로운 프리셋 컬러 팔레트
 * 5개 테마 카테고리(Warm, Nature, Cool, Purple, Neutral) x 4개 색상군 x 10단계 톤/명도 스펙트럼
 */
export const LIBRARY_LABEL_COLOR_PRESETS: LibraryColorPreset[] = [
  // ==========================================
  // 1. Warm (40종: Red, Orange, Amber, Yellow)
  // ==========================================
  // Red
  { label: "Mist Rose", color: "#fee2e2", category: "warm" },
  { label: "Pale Blush", color: "#fecaca", category: "warm" },
  { label: "Salmon Pink", color: "#fca5a5", category: "warm" },
  { label: "Coral Red", color: "#f87171", category: "warm" },
  { label: "Vivid Red", color: "#ef4444", category: "warm" },
  { label: "Crimson", color: "#dc2626", category: "warm" },
  { label: "Carmine", color: "#b91c1c", category: "warm" },
  { label: "Ruby Wine", color: "#991b1b", category: "warm" },
  { label: "Dark Burgundy", color: "#7f1d1d", category: "warm" },
  { label: "Garnet", color: "#450a0a", category: "warm" },
  // Orange
  { label: "Apricot Cream", color: "#ffedd5", category: "warm" },
  { label: "Pale Peach", color: "#fed7aa", category: "warm" },
  { label: "Cantaloupe", color: "#fdba74", category: "warm" },
  { label: "Tangerine", color: "#fb923c", category: "warm" },
  { label: "Pure Orange", color: "#f97316", category: "warm" },
  { label: "Burnt Orange", color: "#ea580c", category: "warm" },
  { label: "Rust", color: "#c2410c", category: "warm" },
  { label: "Cinnamon", color: "#9a3412", category: "warm" },
  { label: "Mahogany", color: "#7c2d12", category: "warm" },
  { label: "Espresso Bark", color: "#431407", category: "warm" },
  // Amber
  { label: "Vanilla Cream", color: "#fef3c7", category: "warm" },
  { label: "Buttercup", color: "#fde68a", category: "warm" },
  { label: "Warm Topaz", color: "#fcd34d", category: "warm" },
  { label: "Golden Amber", color: "#fbbf24", category: "warm" },
  { label: "Pure Amber", color: "#f59e0b", category: "warm" },
  { label: "Ochre Gold", color: "#d97706", category: "warm" },
  { label: "Burnt Ochre", color: "#b45309", category: "warm" },
  { label: "Bronze", color: "#92400e", category: "warm" },
  { label: "Dark Amber", color: "#78350f", category: "warm" },
  { label: "Deep Umber", color: "#451a03", category: "warm" },
  // Yellow
  { label: "Lemon Chiffon", color: "#fef9c3", category: "warm" },
  { label: "Pale Primrose", color: "#fef08a", category: "warm" },
  { label: "Canary Yellow", color: "#fde047", category: "warm" },
  { label: "Sunshine", color: "#facc15", category: "warm" },
  { label: "Sunflower", color: "#eab308", category: "warm" },
  { label: "Goldenrod", color: "#ca8a04", category: "warm" },
  { label: "Dijon", color: "#a16207", category: "warm" },
  { label: "Mustard", color: "#854d0e", category: "warm" },
  { label: "Antique Bronze", color: "#713f12", category: "warm" },
  { label: "Bistre", color: "#422006", category: "warm" },

  // ==========================================
  // 2. Nature (40종: Lime, Green, Emerald, Teal)
  // ==========================================
  // Lime
  { label: "Key Lime Frost", color: "#ecfccb", category: "nature" },
  { label: "Pale Peridot", color: "#d9f99d", category: "nature" },
  { label: "Chartreuse", color: "#bef264", category: "nature" },
  { label: "Bright Lime", color: "#a3e635", category: "nature" },
  { label: "Vivid Lime", color: "#84cc16", category: "nature" },
  { label: "Olive Lime", color: "#65a30d", category: "nature" },
  { label: "Moss Lime", color: "#4d7c0f", category: "nature" },
  { label: "Fern Olive", color: "#3f6212", category: "nature" },
  { label: "Deep Woodland", color: "#365314", category: "nature" },
  { label: "Dark Forest Bark", color: "#1a2e05", category: "nature" },
  // Green
  { label: "Mint Cream", color: "#dcfce7", category: "nature" },
  { label: "Celadon", color: "#bbf7d0", category: "nature" },
  { label: "Meadow Green", color: "#86efac", category: "nature" },
  { label: "Light Green", color: "#4ade80", category: "nature" },
  { label: "Emerald Grass", color: "#22c55e", category: "nature" },
  { label: "Forest Green", color: "#16a34a", category: "nature" },
  { label: "Shamrock", color: "#15803d", category: "nature" },
  { label: "Hunter Green", color: "#166534", category: "nature" },
  { label: "Deep Pine", color: "#14532d", category: "nature" },
  { label: "Midnight Forest", color: "#052e16", category: "nature" },
  // Emerald
  { label: "Pale Jade", color: "#d1fae5", category: "nature" },
  { label: "Seafoam Green", color: "#a7f3d0", category: "nature" },
  { label: "Mint Emerald", color: "#6ee7b7", category: "nature" },
  { label: "Spring Emerald", color: "#34d399", category: "nature" },
  { label: "Pure Emerald", color: "#10b981", category: "nature" },
  { label: "Deep Jade", color: "#059669", category: "nature" },
  { label: "Pine Forest", color: "#047857", category: "nature" },
  { label: "Cypress", color: "#065f46", category: "nature" },
  { label: "Deep Malachite", color: "#064e3b", category: "nature" },
  { label: "Abyssal Emerald", color: "#022c22", category: "nature" },
  // Teal
  { label: "Aquamarine Tint", color: "#ccfbf1", category: "nature" },
  { label: "Ice Teal", color: "#99f6e4", category: "nature" },
  { label: "Aqua Teal", color: "#5eead4", category: "nature" },
  { label: "Aquamarine", color: "#2dd4bf", category: "nature" },
  { label: "Vibrant Teal", color: "#14b8a6", category: "nature" },
  { label: "Dark Teal", color: "#0d9488", category: "nature" },
  { label: "Deep Sea Teal", color: "#0f766e", category: "nature" },
  { label: "Marine Spruce", color: "#115e59", category: "nature" },
  { label: "Oceanic Abyss", color: "#134e4a", category: "nature" },
  { label: "Deep Trench", color: "#042f2e", category: "nature" },

  // ==========================================
  // 3. Cool (40종: Cyan, Sky, Blue, Indigo)
  // ==========================================
  // Cyan
  { label: "Frost Cyan", color: "#cffafe", category: "cool" },
  { label: "Glacial Cyan", color: "#a5f3fc", category: "cool" },
  { label: "Electric Aqua", color: "#67e8f9", category: "cool" },
  { label: "Cyan Lagoon", color: "#22d3ee", category: "cool" },
  { label: "Pure Cyan", color: "#06b6d4", category: "cool" },
  { label: "Ocean Cyan", color: "#0891b2", category: "cool" },
  { label: "Deep Cerulean", color: "#0e7490", category: "cool" },
  { label: "Deep Atlantic", color: "#155e75", category: "cool" },
  { label: "Arctic Night", color: "#164e63", category: "cool" },
  { label: "Deep Fjord", color: "#083344", category: "cool" },
  // Sky
  { label: "Cloud Mist", color: "#e0f2fe", category: "cool" },
  { label: "Powder Blue", color: "#bae6fd", category: "cool" },
  { label: "Sky Blue", color: "#7dd3fc", category: "cool" },
  { label: "Horizon Azure", color: "#38bdf8", category: "cool" },
  { label: "Cerulean", color: "#0ea5e9", category: "cool" },
  { label: "Cobalt Sky", color: "#0284c7", category: "cool" },
  { label: "Pacific Blue", color: "#0369a1", category: "cool" },
  { label: "Marine Blue", color: "#075985", category: "cool" },
  { label: "Midnight Sky", color: "#0c4a6e", category: "cool" },
  { label: "Abyssal Blue", color: "#082f49", category: "cool" },
  // Blue
  { label: "Soft Periwinkle Mist", color: "#dbeafe", category: "cool" },
  { label: "Cornflower Light", color: "#bfdbfe", category: "cool" },
  { label: "Forget-Me-Not", color: "#93c5fd", category: "cool" },
  { label: "Soft Blue", color: "#60a5fa", category: "cool" },
  { label: "Royal Blue", color: "#3b82f6", category: "cool" },
  { label: "True Blue", color: "#2563eb", category: "cool" },
  { label: "Sapphire", color: "#1d4ed8", category: "cool" },
  { label: "Deep Navy", color: "#1e40af", category: "cool" },
  { label: "Midnight Sapphire", color: "#1e3a8a", category: "cool" },
  { label: "Dark Marine", color: "#172554", category: "cool" },
  // Indigo
  { label: "Lavender Mist", color: "#e0e7ff", category: "cool" },
  { label: "Pale Iris", color: "#c7d2fe", category: "cool" },
  { label: "Periwinkle", color: "#a5b4fc", category: "cool" },
  { label: "Soft Indigo", color: "#818cf8", category: "cool" },
  { label: "Classic Indigo", color: "#6366f1", category: "cool" },
  { label: "Deep Indigo", color: "#4f46e5", category: "cool" },
  { label: "Persian Indigo", color: "#4338ca", category: "cool" },
  { label: "Twilight Indigo", color: "#3730a3", category: "cool" },
  { label: "Midnight Ink", color: "#312e81", category: "cool" },
  { label: "Abyssal Iris", color: "#1e1b4b", category: "cool" },

  // ==========================================
  // 4. Purple (40종: Violet, Purple, Fuchsia, Pink)
  // ==========================================
  // Violet
  { label: "Lilac Fog", color: "#ede9fe", category: "purple" },
  { label: "Soft Lilac", color: "#ddd6fe", category: "purple" },
  { label: "Pale Amethyst", color: "#c4b5fd", category: "purple" },
  { label: "Lavender", color: "#a78bfa", category: "purple" },
  { label: "Bright Violet", color: "#8b5cf6", category: "purple" },
  { label: "Deep Violet", color: "#7c3aed", category: "purple" },
  { label: "Royal Purple", color: "#6d28d9", category: "purple" },
  { label: "Dark Amethyst", color: "#5b21b6", category: "purple" },
  { label: "Night Violet", color: "#4c1d95", category: "purple" },
  { label: "Midnight Plum", color: "#2e1065", category: "purple" },
  // Purple
  { label: "Thistle Whisper", color: "#f3e8ff", category: "purple" },
  { label: "Pale Orchid", color: "#e9d5ff", category: "purple" },
  { label: "Orchid Bloom", color: "#d8b4fe", category: "purple" },
  { label: "Bright Purple", color: "#c084fc", category: "purple" },
  { label: "Pure Purple", color: "#a855f7", category: "purple" },
  { label: "Deep Purple", color: "#9333ea", category: "purple" },
  { label: "Imperial Purple", color: "#7e22ce", category: "purple" },
  { label: "Midnight Iris", color: "#6b21a8", category: "purple" },
  { label: "Dark Mulberry", color: "#581c87", category: "purple" },
  { label: "Deep Velvet", color: "#3b0764", category: "purple" },
  // Fuchsia
  { label: "Pink Quartz", color: "#fae8ff", category: "purple" },
  { label: "Cotton Candy", color: "#f5d0fe", category: "purple" },
  { label: "Blossom Pink", color: "#f0abfc", category: "purple" },
  { label: "Neon Fuchsia", color: "#e879f9", category: "purple" },
  { label: "Vivid Fuchsia", color: "#d946ef", category: "purple" },
  { label: "Magenta Berry", color: "#c026d3", category: "purple" },
  { label: "Deep Magenta", color: "#a21caf", category: "purple" },
  { label: "Boysenberry", color: "#86198f", category: "purple" },
  { label: "Dark Plum", color: "#701a75", category: "purple" },
  { label: "Black Cherry", color: "#4a044e", category: "purple" },
  // Pink
  { label: "Cherry Blossom", color: "#fce7f3", category: "purple" },
  { label: "Marshmallow Pink", color: "#fbcfe8", category: "purple" },
  { label: "Carnation Pink", color: "#f9a8d4", category: "purple" },
  { label: "Bubblegum", color: "#f472b6", category: "purple" },
  { label: "Pink Flamingo", color: "#ec4899", category: "purple" },
  { label: "Hot Pink", color: "#db2777", category: "purple" },
  { label: "Deep Rose Pink", color: "#be185d", category: "purple" },
  { label: "Raspberry", color: "#9d174d", category: "purple" },
  { label: "Bordeaux Pink", color: "#831843", category: "purple" },
  { label: "Midnight Ruby", color: "#500724", category: "purple" },

  // ==========================================
  // 5. Neutral & Earth (40종: Rose, Slate, Zinc, Stone)
  // ==========================================
  // Rose
  { label: "Soft Petal", color: "#ffe4e6", category: "neutral" },
  { label: "Morning Rose", color: "#fecdd3", category: "neutral" },
  { label: "Desert Rose", color: "#fda4af", category: "neutral" },
  { label: "Watermelon Rose", color: "#fb7185", category: "neutral" },
  { label: "Crimson Rose", color: "#f43f5e", category: "neutral" },
  { label: "Ruby Rose", color: "#e11d48", category: "neutral" },
  { label: "Rich Carmine", color: "#be123c", category: "neutral" },
  { label: "Antique Crimson", color: "#9f1239", category: "neutral" },
  { label: "Velvet Burgundy", color: "#881337", category: "neutral" },
  { label: "Deep Rosewood", color: "#4c0519", category: "neutral" },
  // Slate
  { label: "Mist Slate", color: "#f1f5f9", category: "neutral" },
  { label: "Pale Steel", color: "#e2e8f0", category: "neutral" },
  { label: "Silver Cloud", color: "#cbd5e1", category: "neutral" },
  { label: "Cool Slate", color: "#94a3b8", category: "neutral" },
  { label: "Classic Slate", color: "#64748b", category: "neutral" },
  { label: "Charcoal Slate", color: "#475569", category: "neutral" },
  { label: "Deep Slate", color: "#334155", category: "neutral" },
  { label: "Midnight Slate", color: "#1e293b", category: "neutral" },
  { label: "Obsidian Navy", color: "#0f172a", category: "neutral" },
  { label: "Abyssal Slate", color: "#020617", category: "neutral" },
  // Zinc
  { label: "Frost Zinc", color: "#f4f4f5", category: "neutral" },
  { label: "Platinum Gray", color: "#e4e4e7", category: "neutral" },
  { label: "Silver Mist", color: "#d4d4d8", category: "neutral" },
  { label: "Steel Gray", color: "#a1a1aa", category: "neutral" },
  { label: "Pure Zinc", color: "#71717a", category: "neutral" },
  { label: "Ash Gray", color: "#52525b", category: "neutral" },
  { label: "Graphite", color: "#3f3f46", category: "neutral" },
  { label: "Dark Charcoal", color: "#27272a", category: "neutral" },
  { label: "Anthracite", color: "#18181b", category: "neutral" },
  { label: "Onyx Black", color: "#09090b", category: "neutral" },
  // Stone
  { label: "Linen Paper", color: "#f5f5f4", category: "neutral" },
  { label: "Warm Sandstone", color: "#e7e5e4", category: "neutral" },
  { label: "Warm Stone", color: "#d6d3d1", category: "neutral" },
  { label: "River Pebble", color: "#a8a29e", category: "neutral" },
  { label: "Classic Stone", color: "#78716c", category: "neutral" },
  { label: "Earth Brown", color: "#57534e", category: "neutral" },
  { label: "Dark Umber Stone", color: "#44403c", category: "neutral" },
  { label: "Dark Walnut", color: "#292524", category: "neutral" },
  { label: "Roast Chestnut", color: "#1c1917", category: "neutral" },
  { label: "Deep Obsidian", color: "#0c0a09", category: "neutral" },
];

/**
 * 서재 세트 기본 대표 색상 (Indigo)
 */
export const DEFAULT_SET_COLOR = "#6366f1";

/**
 * 등록 폴더 기본 대표 색상 (Cerulean)
 */
export const DEFAULT_FOLDER_COLOR = "#0ea5e9";

export interface ThemeColorPreset {
  id: string;
  nameKey: string;
  textColor: string;
  backgroundColor: string;
  previewBadge: string;
}

/**
 * 텍스트/배경 일괄 전환용 퀵 테마 프리셋
 */
export const THEME_COLOR_PRESETS: readonly ThemeColorPreset[] = [
  {
    id: "default",
    nameKey: "style_modal.preset_default",
    textColor: "",
    backgroundColor: "",
    previewBadge: "bg-theme-card text-theme-text border-theme-border",
  },
  {
    id: "dark",
    nameKey: "style_modal.preset_dark",
    textColor: "#f3efe6",
    backgroundColor: "#1c1917",
    previewBadge: "bg-[#1c1917] text-[#f3efe6] border-[#38332e]",
  },
  {
    id: "white",
    nameKey: "style_modal.preset_white",
    textColor: "#111111",
    backgroundColor: "#ffffff",
    previewBadge: "bg-[#ffffff] text-[#111111] border-[#e5e5e5]",
  },
  {
    id: "midnight",
    nameKey: "style_modal.preset_midnight",
    textColor: "#e0e7ff",
    backgroundColor: "#0f172a",
    previewBadge: "bg-[#0f172a] text-[#e0e7ff] border-[#1e293b]",
  },
] as const;

/**
 * 200종 프리셋 컬러 중 랜덤 1개 반환 (신규 추가 시 Zero-Config 자동 배정용)
 */
export function getRandomLibraryColor(): string {
  const index = Math.floor(Math.random() * LIBRARY_LABEL_COLOR_PRESETS.length);
  return LIBRARY_LABEL_COLOR_PRESETS[index].color;
}
