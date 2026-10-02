import i18n from "../i18n";
import { fontService } from "./fontService";
import {
  settingsService,
  defaultSettings,
  sanitizeFontSortSettings,
  type CustomAppSettings,
} from "./settingsService";
import { appConfig, VALID_THEMES, type AppTheme, type LibraryCategory } from "../config/appConfig";
import type {
  AppBackupData,
  BackupCategorySelection,
  BackupFolder,
  BackupSet,
  BackupSummary,
} from "../types/backup";

const MAX_JSON_STRING_LENGTH = 10 * 1024 * 1024; // 10MB 최대 크기 제한
const MAX_COLLECTION_ITEMS = 1000; // 폴더 및 서재 세트 최대 개수 제한
const MAX_FONTS_PER_SET = 10000; // 세트당 최대 폰트 ID 개수 제한
const HEX_COLOR_REGEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

/**
 * 16진수 색상 코드 검증 및 정제 (CSS/HTML 주입 방어)
 */
function sanitizeColor(val: unknown, fallback: string): string {
  if (typeof val === "string" && HEX_COLOR_REGEX.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

/**
 * 안전한 텍스트 정제 (길이 제한 및 제어 문자 차단)
 */
function sanitizeString(val: unknown, maxLen = 255): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, maxLen);
}

/**
 * 날짜 기반 백업 파일명 생성: {VITE_APP_NAME}-YYMMDD-HHIISS.json
 */
function getBackupFileName(): string {
  const appName = (appConfig.app.name || "fontfinder")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, "");

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const ii = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return `${appName}-${yy}${mm}${dd}-${hh}${ii}${ss}.json`;
}

/**
 * Prototype Pollution 방어 기능을 포함한 안전한 JSON 파서
 */
function safeJsonParse(content: string): unknown {
  if (content.length > MAX_JSON_STRING_LENGTH) {
    throw new Error(
      i18n.t("backup.size_limit", "백업 파일의 크기가 제한(10MB)을 초과했습니다.")
    );
  }

  return JSON.parse(content, (key, value) => {
    // __proto__, constructor, prototype 키를 차단하여 Object 오염 방지
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      return undefined;
    }
    return value;
  });
}

/**
 * 외부 입력 설정값(settings) 엄격 검증 및 화이트리스트 정제
 */
function sanitizeSettings(raw: unknown): CustomAppSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;

  const theme: AppTheme =
    typeof obj.theme === "string" && VALID_THEMES.includes(obj.theme as AppTheme)
      ? (obj.theme as AppTheme)
      : defaultSettings.theme;

  const validCategories: LibraryCategory[] = [
    "all",
    "user",
    "system",
    "activated",
    "favorites",
    "duplicates",
  ];
  const defaultCategory: LibraryCategory =
    typeof obj.defaultCategory === "string" &&
    validCategories.includes(obj.defaultCategory as LibraryCategory)
      ? (obj.defaultCategory as LibraryCategory)
      : defaultSettings.defaultCategory;

  const minFontSize = Math.min(32, Math.max(8, Number(obj.minFontSize) || defaultSettings.minFontSize));
  const maxFontSize = Math.min(200, Math.max(20, Number(obj.maxFontSize) || defaultSettings.maxFontSize));
  const defaultFontSize = Math.min(maxFontSize, Math.max(minFontSize, Number(obj.defaultFontSize) || defaultSettings.defaultFontSize));
  const defaultGridColumns = Math.min(5, Math.max(2, Number(obj.defaultGridColumns) || defaultSettings.defaultGridColumns));
  const defaultVariableWeight = Math.min(900, Math.max(100, Number(obj.defaultVariableWeight) || defaultSettings.defaultVariableWeight));

  const validViewModes = ["list", "grid"] as const;
  const defaultViewMode =
    typeof obj.defaultViewMode === "string" && (validViewModes as readonly string[]).includes(obj.defaultViewMode)
      ? (obj.defaultViewMode as "list" | "grid")
      : defaultSettings.defaultViewMode;

  const validDetailModes = ["detailed", "simple"] as const;
  const defaultFontDetailMode =
    typeof obj.defaultFontDetailMode === "string" && (validDetailModes as readonly string[]).includes(obj.defaultFontDetailMode)
      ? (obj.defaultFontDetailMode as "detailed" | "simple")
      : defaultSettings.defaultFontDetailMode;

  const validAligns = ["left", "center", "right"] as const;
  const defaultTextAlign =
    typeof obj.defaultTextAlign === "string" && (validAligns as readonly string[]).includes(obj.defaultTextAlign)
      ? (obj.defaultTextAlign as "left" | "center" | "right")
      : defaultSettings.defaultTextAlign;

  return {
    ...defaultSettings,
    language: sanitizeString(obj.language, 10) || defaultSettings.language,
    theme,
    defaultCategory,
    minFontSize,
    maxFontSize,
    defaultFontSize,
    defaultGridColumns,
    defaultVariableWeight,
    defaultViewMode,
    defaultFontDetailMode,
    defaultPreviewText: sanitizeString(obj.defaultPreviewText, 2000) || defaultSettings.defaultPreviewText,
    defaultTextColor: sanitizeColor(obj.defaultTextColor, ""),
    defaultBackgroundColor: sanitizeColor(obj.defaultBackgroundColor, ""),
    defaultTextAlign,
    defaultLineHeight: Math.min(3, Math.max(0.5, Number(obj.defaultLineHeight) || defaultSettings.defaultLineHeight)),
    defaultLetterSpacing: Math.min(100, Math.max(-20, Number(obj.defaultLetterSpacing) || defaultSettings.defaultLetterSpacing)),
    fontSortSettings: sanitizeFontSortSettings(obj.fontSortSettings),
  };
}

/**
 * 외부 입력 폴더(folders) 엄격 검증 및 정제
 */
function sanitizeFolders(raw: unknown): BackupFolder[] {
  if (!Array.isArray(raw)) return [];
  const validFolders: BackupFolder[] = [];

  for (const item of raw.slice(0, MAX_COLLECTION_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const path = sanitizeString(item.path, 1024);
    if (!path) continue;

    validFolders.push({
      path,
      name: sanitizeString(item.name, 100) || path.split(/[/\\]/).pop() || "Folder",
      color: sanitizeColor(item.color, "#0ea5e9"),
    });
  }

  return validFolders;
}

/**
 * 외부 입력 서재 세트(sets) 엄격 검증 및 정제
 */
function sanitizeSets(raw: unknown): BackupSet[] {
  if (!Array.isArray(raw)) return [];
  const validSets: BackupSet[] = [];

  for (const item of raw.slice(0, MAX_COLLECTION_ITEMS)) {
    if (!item || typeof item !== "object") continue;
    const name = sanitizeString(item.name, 100);
    if (!name) continue;

    const fontIds: number[] = [];
    if (Array.isArray(item.fontIds)) {
      for (const fid of item.fontIds.slice(0, MAX_FONTS_PER_SET)) {
        const num = Number(fid);
        if (Number.isInteger(num) && num > 0) fontIds.push(num);
      }
    }

    validSets.push({
      name,
      color: sanitizeColor(item.color, "#6366f1"),
      fontIds,
    });
  }

  return validSets;
}

/**
 * 파싱된 JSON을 안전하고 검증된 AppBackupData 객체로 정제 (Defensive Normalization)
 */
function validateAndNormalizeBackupData(raw: unknown): AppBackupData {
  if (!raw || typeof raw !== "object") {
    throw new Error(i18n.t("backup.invalid_data", "유효하지 않은 백업 데이터입니다."));
  }

  const root = raw as Record<string, unknown>;
  // 하위 호환성: 만약 기존 { data: { ... } } 구조가 들어오면 data 내부 객체를 사용
  const source = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;

  const settings = sanitizeSettings(source.settings);
  const folders = sanitizeFolders(source.folders);
  const sets = sanitizeSets(source.sets);

  const hasAnyData = Boolean(settings || folders.length > 0 || sets.length > 0);
  if (!hasAnyData) {
    throw new Error(
      i18n.t(
        "backup.empty_data",
        "백업 파일에 유효한 설정, 폴더, 또는 서재 데이터가 없습니다."
      )
    );
  }

  return {
    settings,
    folders: folders.length > 0 ? folders : undefined,
    sets: sets.length > 0 ? sets : undefined,
  };
}

/**
 * 백업 데이터 요약 정보 추출
 */
export function summarizeBackupData(data: AppBackupData): BackupSummary {
  return {
    hasSettings: Boolean(data.settings && Object.keys(data.settings).length > 0),
    foldersCount: Array.isArray(data.folders) ? data.folders.length : 0,
    setsCount: Array.isArray(data.sets) ? data.sets.length : 0,
  };
}

export const backupService = {
  /**
   * 현재 상태 요약 정보 조회 (내보내기 모달 개수 표시용)
   */
  async getCurrentSummary(): Promise<BackupSummary> {
    try {
      const [folders, sets] = await Promise.all([
        fontService.getFolders().catch(() => []),
        fontService.getSets().catch(() => []),
      ]);
      return {
        hasSettings: true,
        foldersCount: folders.length,
        setsCount: sets.length,
      };
    } catch {
      return {
        hasSettings: true,
        foldersCount: 0,
        setsCount: 0,
      };
    }
  },

  /**
   * 선택된 항목들을 기반으로 내보낼 JSON 데이터 객체 생성 (메타데이터 제거된 간결한 구조)
   */
  async createExportPayload(selection: BackupCategorySelection): Promise<AppBackupData> {
    const payload: AppBackupData = {};

    if (selection.settings) {
      payload.settings = await settingsService.loadSettings();
    }

    if (selection.folders) {
      const folders = await fontService.getFolders();
      payload.folders = folders.map((f) => ({
        path: f.path,
        name: f.name,
        color: f.color,
      }));
    }

    if (selection.sets) {
      const sets = await fontService.getSets();
      const allSetFonts = await fontService.getAllSetFontIds().catch(() => ({} as Record<number, number[]>));
      payload.sets = sets.map((s) => ({
        name: s.name,
        color: s.color,
        fontIds: allSetFonts[s.id] ?? [],
      }));
    }

    return payload;
  },

  /**
   * 백업 데이터를 JSON 파일로 저장 (파일명: {VITE_APP_NAME}-YYMMDD-HHIISS.json)
   */
  async saveBackupToFile(data: AppBackupData): Promise<boolean> {
    const jsonString = JSON.stringify(data, null, 2);
    const defaultFileName = getBackupFileName();

    try {
      // 1. Tauri Native Dialog & Backend Rust Command 시도
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const filePath = await save({
        defaultPath: defaultFileName,
        filters: [{ name: "JSON Backup", extensions: ["json"] }],
      });

      if (!filePath) {
        return false;
      }

      await invoke("save_backup_file", { path: filePath, content: jsonString });
      return true;
    } catch {
      // 2. 브라우저/웹 환경 폴백
      try {
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = defaultFileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return true;
      } catch (err) {
        console.error("파일 저장 실패:", err);
        throw new Error(
          err instanceof Error
            ? err.message
            : i18n.t("backup.save_failed", "파일 저장에 실패했습니다.")
        );
      }
    }
  },

  /**
   * JSON 백업 파일 선택 및 엄격 검증 파싱
   */
  async selectAndReadBackupFile(): Promise<AppBackupData | null> {
    let content: string | null = null;

    try {
      // 1. Tauri Native Dialog & Backend Rust Command 시도
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "JSON Backup", extensions: ["json"] }],
      });

      if (!selected || typeof selected !== "string") {
        return null;
      }

      content = await invoke<string>("read_backup_file", { path: selected });
    } catch {
      // 2. 브라우저/웹 환경 폴백
      content = await new Promise<string | null>((resolve, reject) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) {
            resolve(null);
            return;
          }
          if (file.size > MAX_JSON_STRING_LENGTH) {
            reject(
              new Error(
                i18n.t(
                  "backup.size_limit",
                  "파일 크기가 10MB를 초과하여 불러올 수 없습니다."
                )
              )
            );
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () =>
            reject(new Error(i18n.t("backup.read_failed", "파일을 읽을 수 없습니다.")));
          reader.readAsText(file);
        };
        input.click();
      });
    }

    if (!content) return null;

    try {
      const parsed = safeJsonParse(content);
      return validateAndNormalizeBackupData(parsed);
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error(
        i18n.t(
          "backup.json_parse_failed",
          "JSON 파싱에 실패했습니다. 올바른 백업 파일인지 확인해주세요."
        )
      );
    }
  },

  /**
   * 선택된 항목 복원/가져오기 실행 (정제된 데이터만 안전하게 주입)
   */
  async importBackupData(
    backup: AppBackupData,
    selection: BackupCategorySelection
  ): Promise<{ settings: boolean; foldersAdded: number; setsAdded: number }> {
    let settingsApplied = false;
    let foldersAdded = 0;
    let setsAdded = 0;

    // 1. 시스템 설정 복원
    if (selection.settings && backup.settings) {
      await settingsService.saveSettings(backup.settings);
      settingsApplied = true;
    }

    // 2. 폴더 복원
    if (selection.folders && backup.folders && backup.folders.length > 0) {
      const currentFolders = await fontService.getFolders().catch(() => []);
      const existingPaths = new Set(currentFolders.map((f) => f.path));

      for (const folder of backup.folders) {
        if (!folder.path || existingPaths.has(folder.path)) continue;
        try {
          await fontService.addFolder(folder.path, folder.name, folder.color);
          await fontService.watchFolder(folder.path).catch(() => {});
          existingPaths.add(folder.path);
          foldersAdded++;
        } catch (e) {
          console.warn(`폴더 추가 실패 (${folder.path}):`, e);
        }
      }
    }

    // 3. 서재 세트 복원 (사전 일괄 조회로 1+N 쿼리 및 IPC 방지)
    if (selection.sets && backup.sets && backup.sets.length > 0) {
      const [currentSets, allSetFonts] = await Promise.all([
        fontService.getSets().catch(() => []),
        fontService.getAllSetFontIds().catch(() => ({} as Record<number, number[]>)),
      ]);
      const setMap = new Map(currentSets.map((s) => [s.name, s]));
      const existingSetFontsMap = new Map<number, Set<number>>(
        Object.entries(allSetFonts).map(([k, v]) => [Number(k), new Set(v)])
      );

      for (const setItem of backup.sets) {
        if (!setItem.name) continue;
        try {
          let targetSetId: number;
          const existingSet = setMap.get(setItem.name);

          if (existingSet) {
            targetSetId = existingSet.id;
          } else {
            const created = await fontService.createSet(setItem.name, setItem.color);
            targetSetId = created.id;
            setMap.set(setItem.name, created);
            existingSetFontsMap.set(targetSetId, new Set());
            setsAdded++;
          }

          if (Array.isArray(setItem.fontIds) && setItem.fontIds.length > 0) {
            const existingFontIds = existingSetFontsMap.get(targetSetId) ?? new Set<number>();
            const toAdd = setItem.fontIds.filter((fontId) => !existingFontIds.has(fontId));
            if (toAdd.length > 0) {
              await fontService.addFontsToSetBulk(targetSetId, toAdd).catch(() => {});
              toAdd.forEach((id) => existingFontIds.add(id));
            }
          }
        } catch (e) {
          console.warn(`세트 복원 실패 (${setItem.name}):`, e);
        }
      }
    }

    return {
      settings: settingsApplied,
      foldersAdded,
      setsAdded,
    };
  },
};
