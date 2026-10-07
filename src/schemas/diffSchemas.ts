import { z } from "zod";
import type { DiffMasterSettings, DiffSlotState } from "../types/diff";

export const DIFF_BOUNDS = {
  fontSize: {
    min: 100,
    max: 500,
    sliderMin: 240,
    sliderMax: 400,
    default: 280,
  },
  opacity: {
    min: 0,
    max: 100,
    default: 60,
  },
  text: {
    maxChars: 4,
    default: "Rghe",
  },
} as const;

/**
 * 글리프 비교 모달 전역 마스터 설정 검증 스키마 생성기
 */
export const createDiffMasterSettingsSchema = (fallbackText: string = DIFF_BOUNDS.text.default) => {
  const cleanFallback =
    Array.from((fallbackText || DIFF_BOUNDS.text.default).replace(/\s+/g, ""))
      .slice(0, DIFF_BOUNDS.text.maxChars)
      .join("") || DIFF_BOUNDS.text.default;

  return z.object({
    text: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return cleanFallback;
        const cleaned = Array.from(val.replace(/\s+/g, ""))
          .slice(0, DIFF_BOUNDS.text.maxChars)
          .join("");
        return cleaned || cleanFallback;
      }),
    fontSize: z
      .number()
      .catch(DIFF_BOUNDS.fontSize.default)
      .transform((val) =>
        Math.max(DIFF_BOUNDS.fontSize.min, Math.min(DIFF_BOUNDS.fontSize.max, val))
      ),
    showGrid: z.boolean().catch(true),
    showGuidelines: z.boolean().optional().catch(false),
    isBold: z.boolean().catch(false),
    isItalic: z.boolean().catch(false),
    renderMode: z.enum(["fill", "stroke"]).catch("fill"),
  });
};

export const diffMasterSettingsSchema = createDiffMasterSettingsSchema();

/**
 * 단일 슬롯 상태 검증 스키마 생성기
 */
export const createDiffSlotStateSchema = (slotIndex: number) =>
  z.object({
    slotIndex: z.literal(slotIndex).catch(slotIndex as any),
    font: z.any().nullable().catch(null),
    fontFamily: z.string().catch("var(--font-system)"),
    visible: z.boolean().catch(true),
    opacity: z
      .number()
      .catch(DIFF_BOUNDS.opacity.default)
      .transform((val) =>
        Math.max(DIFF_BOUNDS.opacity.min, Math.min(DIFF_BOUNDS.opacity.max, val))
      ),
    fontSize: z
      .number()
      .catch(DIFF_BOUNDS.fontSize.default)
      .transform((val) =>
        Math.max(DIFF_BOUNDS.fontSize.min, Math.min(DIFF_BOUNDS.fontSize.max, val))
      ),
    offsetX: z.number().catch(0),
    offsetY: z.number().catch(0),
    isBold: z.boolean().catch(false),
    isItalic: z.boolean().catch(false),
    renderMode: z.enum(["fill", "stroke"]).catch("fill"),
  });

export const diffSlotStateSchema = z.object({
  slotIndex: z.number().int().min(0).max(4).catch(0),
  font: z.any().nullable().catch(null),
  fontFamily: z.string().catch("var(--font-system)"),
  visible: z.boolean().catch(true),
  opacity: z
    .number()
    .catch(DIFF_BOUNDS.opacity.default)
    .transform((val) =>
      Math.max(DIFF_BOUNDS.opacity.min, Math.min(DIFF_BOUNDS.opacity.max, val))
    ),
  fontSize: z
    .number()
    .catch(DIFF_BOUNDS.fontSize.default)
    .transform((val) =>
      Math.max(DIFF_BOUNDS.fontSize.min, Math.min(DIFF_BOUNDS.fontSize.max, val))
    ),
  offsetX: z.number().catch(0),
  offsetY: z.number().catch(0),
  isBold: z.boolean().catch(false),
  isItalic: z.boolean().catch(false),
  renderMode: z.enum(["fill", "stroke"]).catch("fill"),
});

/**
 * 마스터 설정 정제 헬퍼 함수
 */
export function sanitizeDiffMasterSettings(
  raw: unknown,
  fallbackText?: string
): DiffMasterSettings {
  if (!raw || typeof raw !== "object") {
    const cleanFallback =
      Array.from((fallbackText || DIFF_BOUNDS.text.default).replace(/\s+/g, ""))
        .slice(0, DIFF_BOUNDS.text.maxChars)
        .join("") || DIFF_BOUNDS.text.default;
    return {
      text: cleanFallback,
      fontSize: DIFF_BOUNDS.fontSize.default,
      showGrid: true,
      showGuidelines: false,
      isBold: false,
      isItalic: false,
      renderMode: "fill",
    };
  }
  return createDiffMasterSettingsSchema(fallbackText).parse(raw) as DiffMasterSettings;
}

/**
 * 슬롯 상태 정제 헬퍼 함수
 */
export function sanitizeDiffSlotState(raw: unknown, slotIndex: number): DiffSlotState {
  if (!raw || typeof raw !== "object") {
    return {
      slotIndex,
      font: null,
      fontFamily: "var(--font-system)",
      visible: true,
      opacity: DIFF_BOUNDS.opacity.default,
      fontSize: DIFF_BOUNDS.fontSize.default,
      offsetX: 0,
      offsetY: 0,
      isBold: false,
      isItalic: false,
      renderMode: "fill",
    };
  }
  return createDiffSlotStateSchema(slotIndex).parse(raw) as DiffSlotState;
}
