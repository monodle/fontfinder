import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import i18n from "../../i18n";
import { appConfig } from "../../config/appConfig";
import { singlePathSchema } from "../../schemas";
import type { AppBackupData } from "../../types/backup";
import {
  MAX_JSON_STRING_LENGTH,
  safeJsonParse,
  validateAndNormalizeBackupData,
} from "./backupValidator";

/**
 * 날짜 기반 백업 파일명 생성: {VITE_APP_NAME}-YYMMDD-HHIISS.json
 */
export function getBackupFileName(): string {
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
 * 백업 데이터를 JSON 파일로 저장 (파일명: {VITE_APP_NAME}-YYMMDD-HHIISS.json)
 */
export async function saveBackupToFile(data: AppBackupData): Promise<boolean> {
  const jsonString = JSON.stringify(data, null, 2);
  const defaultFileName = getBackupFileName();

  try {
    // 1. Tauri Native Dialog & Backend Rust Command 시도
    const filePath = await save({
      defaultPath: defaultFileName,
      filters: [{ name: "JSON Backup", extensions: ["json"] }],
    });

    const validatedPath = singlePathSchema.safeParse(filePath);
    if (!validatedPath.success || !validatedPath.data) {
      return false;
    }

    await invoke("save_backup_file", { path: validatedPath.data, content: jsonString });
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
          : i18n.t("backup.save_failed")
      );
    }
  }
}

/**
 * JSON 백업 파일 선택 및 엄격 검증 파싱
 */
export async function selectAndReadBackupFile(): Promise<AppBackupData | null> {
  let content: string | null = null;

  try {
    const selected = await open({
      multiple: false,
      directory: false,
      filters: [{ name: "JSON Backup", extensions: ["json"] }],
    });

    const validatedPath = singlePathSchema.safeParse(selected);
    if (!validatedPath.success || !validatedPath.data) {
      return null;
    }

    content = await invoke<string>("read_backup_file", { path: validatedPath.data });
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
          reject(new Error(i18n.t("backup.size_limit")));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () =>
          reject(new Error(i18n.t("backup.read_failed")));
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
    throw new Error(i18n.t("backup.json_parse_failed"));
  }
}
