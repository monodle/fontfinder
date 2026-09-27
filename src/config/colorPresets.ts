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

/**
 * 서재(세트, 폴더) 라벨용 50종 다채로운 프리셋 컬러 팔레트
 */
export const LIBRARY_LABEL_COLOR_PRESETS: ColorPreset[] = [
  // Red
  { label: "Coral Red", color: "#f87171" },
  { label: "Red", color: "#ef4444" },
  { label: "Crimson", color: "#dc2626" },
  { label: "Dark Red", color: "#b91c1c" },
  // Orange
  { label: "Peach", color: "#fb923c" },
  { label: "Orange", color: "#f97316" },
  { label: "Burnt Orange", color: "#ea580c" },
  { label: "Rust", color: "#c2410c" },
  // Amber
  { label: "Warm Amber", color: "#fbbf24" },
  { label: "Amber", color: "#f59e0b" },
  { label: "Golden", color: "#d97706" },
  { label: "Ochre", color: "#b45309" },
  // Yellow & Lime
  { label: "Sunflower", color: "#eab308" },
  { label: "Dark Yellow", color: "#ca8a04" },
  { label: "Lime", color: "#84cc16" },
  { label: "Olive Green", color: "#65a30d" },
  // Green
  { label: "Light Green", color: "#4ade80" },
  { label: "Green", color: "#22c55e" },
  { label: "Forest", color: "#16a34a" },
  { label: "Dark Green", color: "#15803d" },
  // Emerald
  { label: "Mint Emerald", color: "#34d399" },
  { label: "Emerald", color: "#10b981" },
  { label: "Deep Emerald", color: "#059669" },
  { label: "Pine", color: "#047857" },
  // Teal & Cyan
  { label: "Aquamarine", color: "#2dd4bf" },
  { label: "Teal", color: "#14b8a6" },
  { label: "Dark Teal", color: "#0d9488" },
  { label: "Cyan", color: "#06b6d4" },
  { label: "Ocean Cyan", color: "#0891b2" },
  // Sky & Blue
  { label: "Sky", color: "#38bdf8" },
  { label: "Cerulean", color: "#0ea5e9" },
  { label: "Cobalt", color: "#0284c7" },
  { label: "Soft Blue", color: "#60a5fa" },
  { label: "Blue", color: "#3b82f6" },
  { label: "Royal Blue", color: "#2563eb" },
  { label: "Navy", color: "#1d4ed8" },
  // Indigo & Violet
  { label: "Periwinkle", color: "#818cf8" },
  { label: "Indigo", color: "#6366f1" },
  { label: "Deep Indigo", color: "#4f46e5" },
  { label: "Lavender", color: "#a78bfa" },
  { label: "Violet", color: "#8b5cf6" },
  { label: "Dark Violet", color: "#7c3aed" },
  // Purple & Fuchsia
  { label: "Purple", color: "#a855f7" },
  { label: "Deep Purple", color: "#9333ea" },
  { label: "Fuchsia", color: "#d946ef" },
  { label: "Berry", color: "#c026d3" },
  // Pink & Rose
  { label: "Bubblegum", color: "#f472b6" },
  { label: "Pink", color: "#ec4899" },
  { label: "Rose", color: "#f43f5e" },
  { label: "Ruby", color: "#e11d48" },
  // Neutral / Slate
  { label: "Slate", color: "#64748b" },
  { label: "Charcoal Slate", color: "#475569" },
];

/**
 * 50종 프리셋 컬러 중 랜덤 1개 반환 (신규 추가 시 Zero-Config 자동 배정용)
 */
export function getRandomLibraryColor(): string {
  const index = Math.floor(Math.random() * LIBRARY_LABEL_COLOR_PRESETS.length);
  return LIBRARY_LABEL_COLOR_PRESETS[index].color;
}
