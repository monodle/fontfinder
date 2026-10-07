import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import {
  FontMetadata,
  FontSet,
  DbFolder,
  ActivatedFontRecord,
  FolderStatus,
  FontDetailedInfo,
} from "../types/font";
import { normalizePath } from "../utils/pathUtils";
import { IS_WINDOWS } from "../utils/platform";
import {
  batchInstallResultSchema,
  batchUninstallResultSchema,
  folderStatusListSchema,
  pathTypeInfoListSchema,
  fontSetSchema,
  fontSetListSchema,
  dbFolderSchema,
  dbFolderListSchema,
  activatedFontRecordListSchema,
  fontDetailedInfoSchema,
  fontIdListSchema,
  allSetFontIdsSchema,
  allSetFontsMapSchema,
  systemThemeSchema,
  fontMetadataListSchema,
  type BatchInstallResult,
  type BatchUninstallResult,
  type PathTypeInfo,
} from "../schemas";

export type { BatchInstallResult, BatchUninstallResult, PathTypeInfo };


export const fontService = {
  async getFontDetails(filePath: string, fontIndex: number = 0): Promise<FontDetailedInfo> {
    const raw = await invoke<unknown>("get_font_details", {
      filePath,
      fontIndex,
    });
    return fontDetailedInfoSchema.parse(raw);
  },
  async getCachedFonts(): Promise<FontMetadata[]> {
    const raw = await invoke<unknown>("get_cached_fonts");
    return fontMetadataListSchema.parse(raw);
  },

  async getCachedFontsByHashes(hashes: string[]): Promise<FontMetadata[]> {
    if (!hashes || hashes.length === 0) return [];
    const raw = await invoke<unknown>("get_cached_fonts_by_hashes", { hashes });
    return fontMetadataListSchema.parse(raw);
  },

  async syncFontLibrary(customPaths: string[] = []): Promise<FontMetadata[]> {
    const raw = await invoke<unknown>("sync_font_library", { customPaths });
    return fontMetadataListSchema.parse(raw);
  },

  async scanDirectory(path: string): Promise<FontMetadata[]> {
    const raw = await invoke<unknown>("scan_directory", { path });
    return fontMetadataListSchema.parse(raw);
  },

  async activateFont(path: string, fontId: number): Promise<void> {
    return await invoke<void>("activate_font", { path, fontId });
  },

  async deactivateFont(path: string, fontId: number): Promise<void> {
    return await invoke<void>("deactivate_font", { path, fontId });
  },

  async activateFonts(
    items: { font_id: number; path: string }[]
  ): Promise<number> {
    return await invoke<number>("activate_fonts", { items });
  },

  async deactivateFonts(
    items: { font_id: number; path: string }[]
  ): Promise<number> {
    return await invoke<number>("deactivate_fonts", { items });
  },


  async showInFolder(path: string): Promise<void> {
    return await invoke<void>("show_in_folder", { path });
  },

  async installFonts(paths: string[]): Promise<BatchInstallResult> {
    const raw = await invoke<unknown>("install_fonts", { paths });
    return batchInstallResultSchema.parse(raw);
  },

  async uninstallFonts(paths: string[]): Promise<BatchUninstallResult> {
    const raw = await invoke<unknown>("uninstall_fonts", { paths });
    return batchUninstallResultSchema.parse(raw);
  },


  // --- Sets ---
  async createSet(name: string, color?: string, parentId?: number | null, sortOrder?: string): Promise<FontSet> {
    const raw = await invoke<unknown>("create_set", { name, color, parentId: parentId ?? null, sortOrder: sortOrder ?? null });
    return fontSetSchema.parse(raw);
  },

  async updateSetColor(setId: number, color: string): Promise<void> {
    return await invoke<void>("update_set_color", { setId, color });
  },

  async updateSet(setId: number, name: string, color: string, parentId?: number | null): Promise<void> {
    return await invoke<void>("update_set", { setId, name, color, parentId: parentId ?? null });
  },

  async updateSetParent(setId: number, parentId: number | null): Promise<void> {
    return await invoke<void>("update_set_parent", { setId, parentId });
  },

  async updateSetPosition(setId: number, parentId: number | null, sortOrder: string): Promise<void> {
    return await invoke<void>("update_set_position", { setId, parentId, sortOrder });
  },

  async getSets(): Promise<FontSet[]> {
    const raw = await invoke<unknown>("get_sets");
    return fontSetListSchema.parse(raw);
  },

  async deleteSet(setId: number): Promise<void> {
    return await invoke<void>("delete_set", { setId });
  },

  async addFontToSet(setId: number, fontId: number): Promise<void> {
    return await invoke<void>("add_font_to_set", { setId, fontId });
  },

  async removeFontFromSet(setId: number, fontId: number): Promise<void> {
    return await invoke<void>("remove_font_from_set", { setId, fontId });
  },

  async getSetFontIds(setId: number): Promise<number[]> {
    const raw = await invoke<unknown>("get_set_font_ids", { setId });
    return fontIdListSchema.parse(raw);
  },

  async getAllSetFontIds(): Promise<Record<number, number[]>> {
    const raw = await invoke<unknown>("get_all_set_font_ids");
    return allSetFontIdsSchema.parse(raw);
  },

  async getAllSetFontIdsMap(): Promise<Map<number, number[]>> {
    const raw = await invoke<unknown>("get_all_set_font_ids");
    return allSetFontsMapSchema.parse(raw);
  },

  async addFontsToSetBulk(setId: number, fontIds: number[]): Promise<void> {
    if (!fontIds || fontIds.length === 0) return;
    return await invoke<void>("add_fonts_to_set_bulk", { setId, fontIds });
  },

  async removeFontsFromSetBulk(setId: number, fontIds: number[]): Promise<void> {
    if (!fontIds || fontIds.length === 0) return;
    return await invoke<void>("remove_fonts_from_set_bulk", { setId, fontIds });
  },

  // --- Favorites ---
  async toggleFavorite(fontId: number): Promise<boolean> {
    return await invoke<boolean>("toggle_favorite", { fontId });
  },

  async setFavoritesBulk(fontIds: number[], add: boolean): Promise<void> {
    if (!fontIds || fontIds.length === 0) return;
    return await invoke<void>("set_favorites_bulk", { fontIds, add });
  },

  async getFavoriteFontIds(): Promise<number[]> {
    const raw = await invoke<unknown>("get_favorite_font_ids");
    return fontIdListSchema.parse(raw);
  },

  async getCachedFontsByIds(ids: number[]): Promise<FontMetadata[]> {
    if (!ids || ids.length === 0) return [];
    const raw = await invoke<unknown>("get_cached_fonts_by_ids", { ids });
    return fontMetadataListSchema.parse(raw);
  },


  getFontUrl(filePath: string): string {
    const cleanPath = normalizePath(filePath);
    try {
      return convertFileSrc(cleanPath, "font");
    } catch {
      const parts = cleanPath.split("/").map((seg) => encodeURIComponent(seg));
      const joined = parts.join("/");
      if (IS_WINDOWS) {
        return `http://font.localhost/${joined.replace(/^\/+/, "")}`;
      }
      return `font://localhost${joined.startsWith("/") ? "" : "/"}${joined}`;
    }
  },

  // --- Folder Watcher ---
  async watchFolder(path: string): Promise<void> {
    return await invoke<void>("watch_folder", { path });
  },

  async unwatchFolder(path: string): Promise<void> {
    return await invoke<void>("unwatch_folder", { path });
  },

  // --- Watched Folders DB ---
  async getFolders(): Promise<DbFolder[]> {
    const raw = await invoke<unknown>("get_folders");
    return dbFolderListSchema.parse(raw);
  },

  async addFolder(path: string, name: string, color?: string, sortOrder?: string): Promise<DbFolder> {
    const raw = await invoke<unknown>("add_folder", { path, name, color, sortOrder: sortOrder ?? null });
    return dbFolderSchema.parse(raw);
  },

  async updateFolderColor(folderId: number, color: string): Promise<void> {
    return await invoke<void>("update_folder_color", { folderId, color });
  },

  async updateFolderPosition(folderId: number | null, path: string | null, sortOrder: string): Promise<void> {
    return await invoke<void>("update_folder_position", { folderId, path, sortOrder });
  },

  async removeFolder(path: string): Promise<void> {
    return await invoke<void>("remove_folder", { path });
  },

  async removeFolderWithData(path: string): Promise<void> {
    return await invoke<void>("remove_folder_with_data", { path });
  },

  async checkFoldersStatus(): Promise<FolderStatus[]> {
    const raw = await invoke<unknown>("check_folders_status");
    return folderStatusListSchema.parse(raw);
  },

  async relinkFolder(oldPath: string, newPath: string, newName?: string): Promise<void> {
    return await invoke<void>("relink_folder", { oldPath, newPath, newName });
  },

  async validateAndCleanupActivatedFonts(): Promise<ActivatedFontRecord[]> {
    const raw = await invoke<unknown>("validate_and_cleanup_activated_fonts");
    return activatedFontRecordListSchema.parse(raw);
  },

  // --- App Settings DB ---
  async getSetting(key: string): Promise<string | null> {
    return await invoke<string | null>("get_setting", { key });
  },

  async setSetting(key: string, value: string): Promise<void> {
    return await invoke<void>("set_setting", { key, value });
  },

  async getSystemTheme(): Promise<"dark" | "light"> {
    try {
      const raw = await invoke<unknown>("get_system_theme");
      return systemThemeSchema.parse(raw);
    } catch {
      return "light";
    }
  },

  async setWindowTheme(theme: "dark" | "light" | null): Promise<void> {
    try {
      await invoke<void>("set_window_theme", { theme });
    } catch {
      // ignore
    }
  },

  async resetAppData(): Promise<void> {
    return await invoke<void>("reset_app_data");
  },

  async checkPaths(paths: string[]): Promise<PathTypeInfo[]> {
    if (!paths || paths.length === 0) return [];
    const raw = await invoke<unknown>("check_paths", { paths });
    return pathTypeInfoListSchema.parse(raw);
  },
};



