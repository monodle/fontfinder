import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import {
  FontMetadata,
  FontSet,
  DbFolder,
  ActivatedFontRecord,
  FolderStatus,
  FontDetailedInfo,
} from "../types/font";

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

  async activateFont(path: string, fontId?: string): Promise<void> {
    return await invoke<void>("activate_font", { path, fontId });
  },

  async deactivateFont(path: string, fontId?: string): Promise<void> {
    return await invoke<void>("deactivate_font", { path, fontId });
  },

  async activateFonts(
    items: { font_id: string; path: string }[] | string[]
  ): Promise<number> {
    const formatted = items.map((it) =>
      typeof it === "string" ? { font_id: it, path: it } : it
    );
    return await invoke<number>("activate_fonts", { items: formatted });
  },

  async deactivateFonts(
    items: { font_id: string; path: string }[] | string[]
  ): Promise<number> {
    const formatted = items.map((it) =>
      typeof it === "string" ? { font_id: it, path: it } : it
    );
    return await invoke<number>("deactivate_fonts", { items: formatted });
  },

  async getActivatedFonts(): Promise<ActivatedFontRecord[]> {
    return await invoke<ActivatedFontRecord[]>("get_activated_fonts");
  },

  async showInFolder(path: string): Promise<void> {
    return await invoke<void>("show_in_folder", { path });
  },

  async installFonts(paths: string[]): Promise<string[]> {
    return await invoke<string[]>("install_fonts", { paths });
  },

  async uninstallFonts(paths: string[]): Promise<number> {
    return await invoke<number>("uninstall_fonts", { paths });
  },

  // --- Sets ---
  async createSet(name: string, color?: string): Promise<FontSet> {
    return await invoke<FontSet>("create_set", { name, color });
  },

  async updateSetColor(setId: number, color: string): Promise<void> {
    return await invoke<void>("update_set_color", { setId, color });
  },

  async updateSet(setId: number, name: string, color: string): Promise<void> {
    return await invoke<void>("update_set", { setId, name, color });
  },

  async getSets(): Promise<FontSet[]> {
    return await invoke<FontSet[]>("get_sets");
  },

  async deleteSet(setId: number): Promise<void> {
    return await invoke<void>("delete_set", { setId });
  },

  async addFontToSet(setId: number, fontId: string): Promise<void> {
    return await invoke<void>("add_font_to_set", { setId, fontId });
  },

  async removeFontFromSet(setId: number, fontId: string): Promise<void> {
    return await invoke<void>("remove_font_from_set", { setId, fontId });
  },

  async getSetFontIds(setId: number): Promise<string[]> {
    return await invoke<string[]>("get_set_font_ids", { setId });
  },

  // --- Favorites ---
  async toggleFavorite(fontId: string): Promise<boolean> {
    return await invoke<boolean>("toggle_favorite", { fontId });
  },

  async getFavoriteFontIds(): Promise<string[]> {
    return await invoke<string[]>("get_favorite_font_ids");
  },

  getFontUrl(filePath: string): string {
    try {
      return convertFileSrc(filePath, "font");
    } catch {
      const isWindows =
        typeof navigator !== "undefined" &&
        (navigator.userAgent.includes("Windows") || navigator.platform?.includes("Win"));
      const normalized = filePath.replace(/\\/g, "/");
      const parts = normalized.split("/").map((seg) => encodeURIComponent(seg));
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


