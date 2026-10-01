import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Settings,
  Type,
  Sparkles,
  User,
  Zap,
  Heart,
  Copy,
  Plus,
  GripVertical,
  Folder,
  Trash2,
  Tag,
  AlertTriangle,
  FolderSync,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Coffee,
  Loader2,
} from "lucide-react";
import type { SettingsTab } from "../SettingsModal";
import { FontSet, CustomFolder } from "../../types/font";
import appIcon from "@/assets/128x128.png";
import { SortableSidebarList } from "../SortableSidebarList";
import { LibraryItemModal } from "../LibraryItemModal";
import { ConfirmModal } from "../ConfirmModal";
import { ListRefreshButton } from "../ListRefreshButton";

interface CategoryCounts {
  total: number;
  system: number;
  user: number;
  activated: number;
  favorites: number;
  duplicates: number;
}

function getParentDirHint(fullPath: string): string {
  const normalized = fullPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return fullPath;
  return parts[parts.length - 2] || "";
}

interface SidebarProps {
  appName: string;
  appVersion: string;
  activeCategory: string;
  counts: CategoryCounts;
  customFolders: CustomFolder[];
  sets: FontSet[];
  isCollapsed?: boolean;
  isLoading?: boolean;
  onRefresh?: () => void | Promise<void>;
  onToggleCollapse?: () => void;
  onOpenSettings: (tab?: SettingsTab) => void;
  onSelectCategory: (category: string) => void;
  onSelectFolder: (folderPath: string) => void;
  onAddFolder: () => void;
  onRemoveFolder: (folderPath: string) => void;
  onRelinkFolder?: (folderPath: string) => void;
  onReorderFolders: (folders: CustomFolder[]) => void;
  onSelectSet: (setId: number) => void;
  onCreateSet: (name: string, color?: string) => void;
  onDeleteSet: (setId: number) => void;
  onReorderSets: (sets: FontSet[]) => void;
  onUpdateSet?: (setId: number, name: string, color: string) => void;
  onUpdateSetColor?: (setId: number, color: string) => void;
  onUpdateFolderColor?: (folderId: number, color: string) => void;
}

export function Sidebar({
  appName,
  appVersion,
  activeCategory,
  counts,
  customFolders,
  sets,
  isCollapsed = false,
  isLoading = false,
  onRefresh,
  onToggleCollapse,
  onOpenSettings,
  onSelectCategory,
  onSelectFolder,
  onAddFolder,
  onRemoveFolder,
  onRelinkFolder,
  onReorderFolders,
  onSelectSet,
  onCreateSet,
  onDeleteSet,
  onReorderSets,
  onUpdateSet,
  onUpdateSetColor,
  onUpdateFolderColor,
}: SidebarProps) {
  const { t } = useTranslation();
  const [modalTarget, setModalTarget] = useState<
    | { mode: "create_set" }
    | { mode: "edit_set"; id: number; name: string; color: string }
    | { mode: "edit_folder"; id: number; name: string; color: string }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "folder"; path: string; name: string }
    | { type: "set"; id: number; name: string }
    | null
  >(null);

  const categories = useMemo(
    () => [
      {
        id: "all",
        label: t("sidebar.category_all"),
        count: counts.total,
        icon: Type,
      },
      {
        id: "system",
        label: t("sidebar.category_system"),
        count: counts.system,
        icon: Sparkles,
      },
      {
        id: "user",
        label: t("sidebar.category_user"),
        count: counts.user,
        icon: User,
      },
      {
        id: "activated",
        label: t("sidebar.category_activated"),
        count: counts.activated,
        icon: Zap,
      },
      {
        id: "favorites",
        label: t("sidebar.category_favorites"),
        count: counts.favorites,
        icon: Heart,
        iconClass: "fill-rose-500 text-rose-500",
      },
      {
        id: "duplicates",
        label: t("sidebar.category_duplicates"),
        count: counts.duplicates,
        icon: Copy,
      },
    ],
    [t, counts]
  );

  const folderNameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const folder of customFolders) {
      counts.set(folder.name, (counts.get(folder.name) || 0) + 1);
    }
    return counts;
  }, [customFolders]);

  return (
    <aside
      className={`border-r border-theme-border bg-theme-sidebar flex flex-col shrink-0 select-none transition-all duration-200 ease-in-out ${isCollapsed ? "w-14" : "w-64"
        }`}
    >
      {/* App Title Header */}
      <div
        className={`h-14 flex items-center border-b border-theme-border shrink-0 ${isCollapsed ? "justify-center px-1" : "justify-between px-3.5"
          }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-7 h-7 rounded-lg overflow-hidden shrink-0 cursor-pointer flex items-center justify-center shadow-xs hover:scale-105 active:scale-95 transition-transform"
            title={appName}
            onClick={isCollapsed ? onToggleCollapse : undefined}
          >
            <img
              src={appIcon}
              alt={appName}
              className="w-full h-full object-contain select-none"
              draggable={false}
            />
          </div>
          {!isCollapsed && (
            <span className="font-semibold text-sm tracking-tight text-theme-text truncate">
              {appName}
            </span>
          )}
        </div>

        {!isCollapsed && onRefresh && (
          <ListRefreshButton
            onRefresh={onRefresh}
            isLoading={isLoading}
            variant="ghost"
            size="md"
            className="w-7 h-7 p-1 rounded-md shrink-0"
          />
        )}
      </div>

      {/* Sidebar Nav Items */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden text-xs ${isCollapsed ? "p-1.5 space-y-2" : "p-3 space-y-4"
          }`}
      >
        {/* Library Section */}
        <div>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1 pb-1">
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title={`${t("sidebar.expand_menu")} (Ctrl+B / ⌘B)`}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-theme-text-muted hover:text-theme-accent hover:bg-theme-hover transition-colors cursor-pointer"
                  aria-label={t("sidebar.expand_menu")}
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
              {onRefresh && (
                <ListRefreshButton
                  onRefresh={onRefresh}
                  isLoading={isLoading}
                  variant="ghost"
                  size="md"
                  className="w-9 h-9 p-0 flex items-center justify-center rounded-lg"
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="font-semibold text-theme-text-muted uppercase tracking-wider text-[10px]">
                {t("sidebar.library")}
              </span>
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title={`${t("sidebar.collapse_menu")} (Ctrl+B / ⌘B)`}
                  className="flex items-center gap-1 text-[10px] text-theme-text-muted hover:text-theme-accent px-1.5 py-0.5 rounded hover:bg-theme-hover transition-colors cursor-pointer"
                  aria-label={t("sidebar.collapse_menu")}
                >
                  <PanelLeftClose className="w-3 h-3" />
                  <span className="font-medium">{t("sidebar.collapse_menu")}</span>
                </button>
              )}
            </div>
          )}

          <div className="space-y-0.5">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => onSelectCategory(cat.id)}
                  title={`${cat.label} (${cat.count})`}
                  className={`w-full flex items-center rounded-lg font-medium transition-colors cursor-pointer ${isCollapsed
                    ? "w-9 h-9 mx-auto justify-center px-0 py-0"
                    : "justify-between px-2.5 py-2"
                    } ${isActive
                      ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                      : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                    }`}
                >
                  <span
                    className={`flex items-center gap-2 ${isCollapsed ? "justify-center" : ""
                      }`}
                  >
                    <Icon
                      className={`w-3.5 h-3.5 shrink-0 ${cat.iconClass || "text-theme-accent"
                        }`}
                    />
                    {!isCollapsed && <span>{cat.label}</span>}
                  </span>
                  {!isCollapsed && (
                    <span className="text-[11px] font-mono opacity-80">
                      {cat.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Folders List */}
        <div>
          {isCollapsed ? (
            <div className="space-y-1">
              <div className="h-px bg-theme-border my-1.5 mx-1" />
              <button
                type="button"
                onClick={onAddFolder}
                className="w-9 h-9 mx-auto flex items-center justify-center rounded-lg text-theme-text-muted hover:text-theme-accent hover:bg-theme-hover transition-colors cursor-pointer"
                title={`${t("sidebar.folders")} - ${t("sidebar.add_folder")}`}
              >
                <Folder className="w-3.5 h-3.5" />
              </button>
              {customFolders.map((folder) => {
                const isActive = activeCategory === `folder:${folder.path}`;
                const tooltipText = folder.isScanning
                  ? `${folder.name} (${folder.scanProgress && folder.scanProgress.total > 0 ? `${folder.scanProgress.current}/${folder.scanProgress.total}` : t("sidebar.scanning_folder", "스캔 중...")})\n${folder.path}`
                  : `${folder.name} (${folder.count})\n${folder.path}`;

                return (
                  <button
                    key={folder.path}
                    type="button"
                    onClick={() => onSelectFolder(folder.path)}
                    title={tooltipText}
                    className={`w-9 h-9 mx-auto flex items-center justify-center rounded-lg transition-colors cursor-pointer relative ${isActive
                      ? "bg-theme-active text-theme-accent shadow-2xs"
                      : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                      }`}
                  >
                    {folder.isScanning ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-accent shrink-0" />
                    ) : (
                      <span
                        style={{ backgroundColor: folder.color || "#0ea5e9" }}
                        className="w-3 h-3 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                      />
                    )}
                    {folder.isMissing && (
                      <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500 ring-1 ring-white" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 pb-1.5 font-semibold text-theme-text-muted uppercase tracking-wider text-[10px]">
                <span className="flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5" />
                  <span>{t("sidebar.folders")}</span>
                </span>
                <button
                  onClick={onAddFolder}
                  className="hover:text-theme-accent p-0.5 transition-colors text-theme-text-secondary cursor-pointer"
                  title={t("sidebar.add_folder")}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {customFolders.length === 0 ? (
                <div
                  onClick={onAddFolder}
                  className="px-2 py-3 text-center border border-dashed border-theme-border hover:border-theme-border-card-hover rounded-lg text-theme-text-muted hover:text-theme-text cursor-pointer transition-all bg-theme-active/20"
                >
                  <p>{t("sidebar.add_folder_empty")}</p>
                </div>
              ) : (
                <SortableSidebarList
                  items={customFolders}
                  getId={(f) => f.path}
                  onItemClick={(folder) => onSelectFolder(folder.path)}
                  onReorder={onReorderFolders}
                  renderItem={(folder, { isDragging, dropPosition }) => {
                    const isDuplicateName = (folderNameCounts.get(folder.name) || 0) > 1;
                    const parentDir = isDuplicateName ? getParentDirHint(folder.path) : null;
                    const tooltipText = folder.isScanning
                      ? `${folder.name} (${folder.scanProgress && folder.scanProgress.total > 0 ? `${folder.scanProgress.current}/${folder.scanProgress.total} · ${Math.round((folder.scanProgress.current / folder.scanProgress.total) * 100)}%` : t("sidebar.scanning_folder", "스캔 중...")})\n${folder.path}`
                      : `${folder.name} (${folder.count})\n${folder.path}`;

                    return (
                      <div
                        title={tooltipText}
                        className={`relative group w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-all text-left cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30 scale-[0.98] bg-theme-active" : ""
                          } ${dropPosition === "before"
                            ? "border-t-2 border-theme-accent bg-theme-accent-subtle/50"
                            : dropPosition === "after"
                              ? "border-b-2 border-theme-accent bg-theme-accent-subtle/50"
                              : ""
                          } ${activeCategory === `folder:${folder.path}`
                            ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                            : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                          }`}
                      >
                        <span className="flex items-center gap-2 truncate min-w-0 pointer-events-none">
                          <GripVertical className="w-3.5 h-3.5 text-theme-text-muted group-hover:text-theme-accent transition-colors shrink-0" />
                          <span
                            style={{ backgroundColor: folder.color || "#0ea5e9" }}
                            className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                          />
                          {folder.isMissing && (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className={`truncate ${folder.isMissing ? "text-amber-500/90" : folder.isScanning ? "opacity-90" : ""}`}>
                            {folder.name}
                          </span>
                          {folder.isScanning && (
                            <span className="text-[10px] text-theme-accent font-normal shrink-0">
                              {folder.scanProgress && folder.scanProgress.total > 0
                                ? `${Math.round((folder.scanProgress.current / folder.scanProgress.total) * 100)}%`
                                : t("sidebar.scanning_short", "스캔 중...")}
                            </span>
                          )}
                          {parentDir && !folder.isScanning && (
                            <span className="text-[10px] text-theme-text-muted/70 font-mono truncate max-w-[80px] shrink-0">
                              ({parentDir})
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1 shrink-0 ml-1">
                          {folder.id && !folder.isScanning && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTarget({
                                  mode: "edit_folder",
                                  id: folder.id!,
                                  name: folder.name,
                                  color: folder.color || "#0ea5e9",
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:text-theme-accent p-0.5 rounded transition-opacity cursor-pointer text-theme-text-muted"
                              title={t("sidebar.folder_color_title", "폴더 라벨 색상 변경")}
                            >
                              <Palette className="w-3 h-3" />
                            </button>
                          )}
                          {folder.isScanning ? (
                            <div
                              className="flex items-center gap-1 text-[11px] text-theme-accent font-medium select-none px-1"
                              title={folder.scanProgress && folder.scanProgress.total > 0 ? `${folder.scanProgress.current}/${folder.scanProgress.total}` : undefined}
                            >
                              <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-theme-accent" />
                            </div>
                          ) : folder.isMissing ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onRelinkFolder?.(folder.path);
                              }}
                              className="text-amber-500 hover:text-amber-400 p-0.5 rounded cursor-pointer transition-colors"
                              title={t("folder.relink")}
                            >
                              <FolderSync className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <span className="text-[11px] font-mono opacity-80 pointer-events-none">
                              {folder.count}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                type: "folder",
                                path: folder.path,
                                name: folder.name || folder.path.split(/[\\/]/).pop() || folder.path,
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded transition-opacity cursor-pointer text-theme-text-muted"
                            title={t("sidebar.remove_folder")}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Sets & Collections (SQLite-backed) */}
        <div>
          {isCollapsed ? (
            <div className="space-y-1">
              <div className="h-px bg-theme-border my-1.5 mx-1" />
              <button
                type="button"
                onClick={() => setModalTarget({ mode: "create_set" })}
                className="w-9 h-9 mx-auto flex items-center justify-center rounded-lg text-theme-text-muted hover:text-theme-accent hover:bg-theme-hover transition-colors cursor-pointer"
                title={`${t("sidebar.sets")} - ${t("sidebar.create_set")}`}
              >
                <Tag className="w-3.5 h-3.5" />
              </button>
              {sets.map((set) => {
                const isActive = activeCategory === `set:${set.id}`;
                return (
                  <button
                    key={set.id}
                    type="button"
                    onClick={() => onSelectSet(set.id)}
                    title={`${set.name} (${set.count})`}
                    className={`w-9 h-9 mx-auto flex items-center justify-center rounded-lg transition-colors cursor-pointer ${isActive
                      ? "bg-theme-active text-theme-accent shadow-2xs"
                      : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                      }`}
                  >
                    <span
                      style={{ backgroundColor: set.color || "#6366f1" }}
                      className="w-3 h-3 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                    />
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 pb-1.5 font-semibold text-theme-text-muted uppercase tracking-wider text-[10px]">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  <span>{t("sidebar.sets")}</span>
                </span>
                <button
                  onClick={() => setModalTarget({ mode: "create_set" })}
                  className="hover:text-theme-accent p-0.5 text-theme-text-secondary transition-colors cursor-pointer"
                  title={t("sidebar.create_set")}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {sets.length === 0 ? (
                <div
                  onClick={() => setModalTarget({ mode: "create_set" })}
                  className="px-2 py-3 text-center border border-dashed border-theme-border rounded-lg text-theme-text-muted bg-theme-active/20 cursor-pointer hover:border-theme-border-card-hover"
                >
                  <p>{t("sidebar.new_set_empty")}</p>
                </div>
              ) : (
                <SortableSidebarList
                  items={sets}
                  getId={(s) => s.id}
                  onItemClick={(set) => onSelectSet(set.id)}
                  onReorder={onReorderSets}
                  renderItem={(set, { isDragging, dropPosition }) => (
                    <div
                      className={`relative group w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-all text-left cursor-grab active:cursor-grabbing select-none ${isDragging ? "opacity-30 scale-[0.98] bg-theme-active" : ""
                        } ${dropPosition === "before"
                          ? "border-t-2 border-theme-accent bg-theme-accent-subtle/50"
                          : dropPosition === "after"
                            ? "border-b-2 border-theme-accent bg-theme-accent-subtle/50"
                            : ""
                        } ${activeCategory === `set:${set.id}`
                          ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                          : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                        }`}
                    >
                      <span className="flex items-center gap-2 truncate pointer-events-none">
                        <GripVertical className="w-3.5 h-3.5 text-theme-text-muted group-hover:text-theme-accent transition-colors shrink-0" />
                        <span
                          style={{ backgroundColor: set.color || "#6366f1" }}
                          className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                        />
                        <span className="truncate">{set.name}</span>
                      </span>

                      <div className="flex items-center gap-1 shrink-0 ml-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalTarget({
                              mode: "edit_set",
                              id: set.id,
                              name: set.name,
                              color: set.color || "#6366f1",
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-theme-accent transition-opacity cursor-pointer"
                          title={t("sidebar.edit_set_title", "서재 세트 수정")}
                        >
                          <Palette className="w-3 h-3" />
                        </button>
                        <span className="text-[11px] font-mono opacity-80 pointer-events-none">
                          {set.count}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({
                              type: "set",
                              id: set.id,
                              name: set.name,
                            });
                          }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-red-500 transition-opacity cursor-pointer"
                          title={t("sidebar.delete_set")}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  )}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* 좌측 메뉴 최하단 고정 푸터 (후원 및 확장 슬롯 영역) */}
      <div className="border-t border-theme-border shrink-0 bg-theme-sidebar/50">
        {isCollapsed ? (
          <div className="p-2 flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenSettings("sponsor")}
              title={t("sponsor.title", "커피 한 잔 보내기")}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-theme-text-muted hover:text-amber-500 hover:bg-theme-hover transition-colors cursor-pointer"
            >
              <Coffee className="w-4 h-4 text-amber-500" />
            </button>
            <button
              type="button"
              onClick={() => onOpenSettings("all")}
              title={t("sidebar.settings")}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-theme-text-muted hover:text-theme-accent hover:bg-theme-hover transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-3">
            <div className="p-2.5 rounded-xl bg-theme-card/60 border border-theme-border/60 hover:border-theme-border-card-hover transition-all">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-theme-text truncate">
                  Font Finder
                </span>
                <span className="font-mono text-[10px] font-medium text-theme-accent shrink-0 ml-1.5 bg-theme-accent/10 px-1.5 py-0.5 rounded border border-theme-accent/20">
                  {appVersion}
                </span>
              </div>

              {/* 후원/확장 슬롯 영역 */}
              <div className="mt-2 pt-2 border-t border-theme-border/40 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onOpenSettings("sponsor")}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-theme-text-muted hover:text-amber-600 dark:hover:text-amber-400 transition-colors cursor-pointer min-w-0"
                  title={t("sponsor.title", "커피 한 잔 보내기")}
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="truncate">{t("sponsor.title", "커피 한 잔 보내기")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenSettings("all")}
                  className="p-1 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-hover transition-colors cursor-pointer shrink-0"
                  title={t("sidebar.settings")}
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 통합 서재 세트 등록/수정 및 폴더 색상 모달 */}
      {modalTarget && (
        <LibraryItemModal
          isOpen={!!modalTarget}
          onClose={() => setModalTarget(null)}
          mode={modalTarget.mode}
          initialName={modalTarget.mode !== "create_set" ? modalTarget.name : ""}
          initialColor={modalTarget.mode !== "create_set" ? modalTarget.color : undefined}
          onSubmitSet={(name, color) => {
            if (modalTarget.mode === "create_set") {
              onCreateSet(name, color);
            } else if (modalTarget.mode === "edit_set") {
              if (onUpdateSet) {
                onUpdateSet(modalTarget.id, name, color);
              } else {
                onUpdateSetColor?.(modalTarget.id, color);
              }
            }
          }}
          onSubmitFolderColor={(color) => {
            if (modalTarget.mode === "edit_folder") {
              onUpdateFolderColor?.(modalTarget.id, color);
            }
          }}
        />
      )}

      {/* 항목 삭제 확인 커스텀 모달 */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => {
            if (deleteTarget.type === "folder") {
              onRemoveFolder(deleteTarget.path);
            } else if (deleteTarget.type === "set") {
              onDeleteSet(deleteTarget.id);
            }
          }}
          title={
            deleteTarget.type === "folder"
              ? t("sidebar.remove_folder", { defaultValue: "폴더 제거" })
              : t("sidebar.delete_set", { defaultValue: "세트 삭제" })
          }
          itemName={deleteTarget.name}
          description={
            deleteTarget.type === "folder"
              ? t("sidebar.remove_folder_confirm", {
                name: deleteTarget.name,
                defaultValue: `'${deleteTarget.name}' 폴더를 서재에서 제거하시겠습니까?`,
              })
              : t("sidebar.delete_set_confirm", {
                name: deleteTarget.name,
                defaultValue: `'${deleteTarget.name}' 서재 세트를 삭제하시겠습니까?`,
              })
          }
          confirmText={t("common.delete", { defaultValue: "삭제" })}
          cancelText={t("common.cancel", { defaultValue: "취소" })}
          isDanger={true}
        />
      )}
    </aside>
  );
}
