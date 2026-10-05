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

export interface BatchInstallResult {
  installed: string[];
  failed_count: number;
  errors: string[];
}

export interface BatchUninstallResult {
  deleted_count: number;
  failed_count: number;
  errors: string[];
}

export const fontService = {
  async getFontDetails(filePath: string, fontIndex: number = 0): Promise<FontDetailedInfo> {
    return await invoke<FontDetailedInfo>("get_font_details", {
      filePath,
      fontIndex,
    });
  },
  async getCachedFonts(): Promise<FontMetadata[]> {
    return await invoke<FontMetadata[]>("get_cached_fonts");
  },

  async getCachedFontsByHashes(hashes: string[]): Promise<FontMetadata[]> {
    if (!hashes || hashes.length === 0) return [];
    return await invoke<FontMetadata[]>("get_cached_fonts_by_hashes", { hashes });
  },

  async syncFontLibrary(customPaths: string[] = []): Promise<FontMetadata[]> {
    return await invoke<FontMetadata[]>("sync_font_library", { customPaths });
  },

  async scanDirectory(path: string): Promise<FontMetadata[]> {
    return await invoke<FontMetadata[]>("scan_directory", { path });
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
    return await invoke<BatchInstallResult>("install_fonts", { paths });
  },

  async uninstallFonts(paths: string[]): Promise<BatchUninstallResult> {
    return await invoke<BatchUninstallResult>("uninstall_fonts", { paths });
  },

  // --- Sets ---
  async createSet(name: string, color?: string, parentId?: number | null): Promise<FontSet> {
    return await invoke<FontSet>("create_set", { name, color, parentId: parentId ?? null });
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

  async getSets(): Promise<FontSet[]> {
    return await invoke<FontSet[]>("get_sets");
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
    return await invoke<number[]>("get_set_font_ids", { setId });
  },

  async getAllSetFontIds(): Promise<Record<number, number[]>> {
    return await invoke<Record<number, number[]>>("get_all_set_font_ids");
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
    return await invoke<number[]>("get_favorite_font_ids");
  },

  async getCachedFontsByIds(ids: number[]): Promise<FontMetadata[]> {
    if (!ids || ids.length === 0) return [];
    return await invoke<FontMetadata[]>("get_cached_fonts_by_ids", { ids });
  },


  getFontUrl(filePath: string): string {
    const cleanPath = normalizePath(filePath);
    try {
      return convertFileSrc(cleanPath, "font");
    } catch {
      const isWindows =
        typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Windows") || navigator.platform?.includes("Win"));
      const parts = cleanPath.split("/").map((seg) => encodeURIComponent(seg));
      const joined = parts.join("/");
      if (isWindows) {
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
    return await invoke<DbFolder[]>("get_folders");
  },

  async addFolder(path: string, name: string, color?: string): Promise<DbFolder> {
    return await invoke<DbFolder>("add_folder", { path, name, color });
  },

  async updateFolderColor(folderId: number, color: string): Promise<void> {
    return await invoke<void>("update_folder_color", { folderId, color });
  },

  async removeFolder(path: string): Promise<void> {
    return await invoke<void>("remove_folder", { path });
  },

  async removeFolderWithData(path: string): Promise<void> {
    return await invoke<void>("remove_folder_with_data", { path });
  },

  async checkFoldersStatus(): Promise<FolderStatus[]> {
    return await invoke<FolderStatus[]>("check_folders_status");
  },

  async relinkFolder(oldPath: string, newPath: string, newName?: string): Promise<void> {
    return await invoke<void>("relink_folder", { oldPath, newPath, newName });
  },

  async validateAndCleanupActivatedFonts(): Promise<ActivatedFontRecord[]> {
    return await invoke<ActivatedFontRecord[]>("validate_and_cleanup_activated_fonts");
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
      const theme = await invoke<string>("get_system_theme");
      return theme === "dark" ? "dark" : "light";
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
    return await invoke<PathTypeInfo[]>("check_paths", { paths });
  },
};

export interface PathTypeInfo {
  path: string;
  name: string;
  is_dir: boolean;
  exists: boolean;
}


