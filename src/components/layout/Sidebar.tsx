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
  ChevronRight,
  ChevronDown,
  CornerDownRight,
  ArrowUpToLine,
  Search,
  X,
} from "lucide-react";
import type { SettingsTab } from "../SettingsModal";
import { FontSet, CustomFolder } from "../../types/font";
import appIcon from "@/assets/128x128.png";
import { SortableSidebarList } from "../SortableSidebarList";
import { SortableTreeSetList, FlatSetItem } from "../SortableTreeSetList";
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
  onCreateSet: (name: string, color?: string, parentId?: number | null) => void;
  onDeleteSet: (setId: number) => void;
  onReorderSets: (sets: FontSet[]) => void;
  onUpdateSet?: (setId: number, name: string, color: string, parentId?: number | null) => void;
  onUpdateSetParent?: (setId: number, parentId: number | null) => void;
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
  onUpdateSetParent,
  onUpdateSetColor,
  onUpdateFolderColor,
}: SidebarProps) {
  const { t } = useTranslation();
  const [modalTarget, setModalTarget] = useState<
    | { mode: "create_set"; initialParentId?: number | null }
    | { mode: "edit_set"; id: number; name: string; color: string; parent_id?: number | null }
    | { mode: "edit_folder"; id: number; name: string; color: string }
    | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { type: "folder"; path: string; name: string }
    | { type: "set"; id: number; name: string; childNames?: string[] }
    | null
  >(null);

  // 1depth 세트 접기/펼치기 상태 관리
  const [collapsedSetIds, setCollapsedSetIds] = useState<Set<number>>(new Set());

  const toggleCollapseSet = (setId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSetIds((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) {
        next.delete(setId);
      } else {
        next.add(setId);
      }
      return next;
    });
  };

  // 계층형 세트 트리 구성 (고아 세트 자동 최상위 1depth 복구 및 방어)
  const setTree = useMemo(() => {
    const parentSets = sets.filter((s) => s.parent_id == null);
    const parentIdSet = new Set(parentSets.map((p) => p.id));
    const childrenMap = new Map<number, FontSet[]>();
    const orphanSets: FontSet[] = [];

    for (const s of sets) {
      if (s.parent_id != null) {
        if (parentIdSet.has(s.parent_id)) {
          const list = childrenMap.get(s.parent_id) ?? [];
          list.push(s);
          childrenMap.set(s.parent_id, list);
        } else {
          // 부모가 없어진 고아 세트: 최상위(1depth)로 안전하게 자동 복구하여 절대 유실되지 않음
          orphanSets.push({ ...s, parent_id: null });
        }
      }
    }

    const allParents = [...parentSets, ...orphanSets];
    return allParents.map((parent) => ({
      parent,
      children: childrenMap.get(parent.id) ?? [],
    }));
  }, [sets]);

  // 통합 드래그 앤 드롭을 위한 평면화 세트 목록
  const flatSetList = useMemo<FlatSetItem[]>(() => {
    const flat: FlatSetItem[] = [];

    for (const { parent, children } of setTree) {
      flat.push({
        set: parent,
        depth: 1,
        parentId: null,
        hasChildren: children.length > 0,
        isCollapsed: false,
      });

      if (children.length > 0) {
        for (const child of children) {
          flat.push({
            set: child,
            depth: 2,
            parentId: parent.id,
            hasChildren: false,
            isCollapsed: false,
          });
        }
      }
    }

    return flat;
  }, [setTree]);

  // 서재 세트 검색 상태 관리
  const [setSearchQuery, setSetSearchQuery] = useState("");
  const [isSetSearchOpen, setIsSetSearchOpen] = useState(false);

  // 검색어에 따른 세트 트리 필터링 (확정 기획안 적용: 2depth 일치 시 1depth 부모 맥락 노출, 1depth 일치 시 1depth 단독 노출)
  const displayFlatSetList = useMemo<FlatSetItem[]>(() => {
    const q = setSearchQuery.trim().toLowerCase();
    if (!q) return flatSetList;

    const result: FlatSetItem[] = [];

    for (const { parent, children } of setTree) {
      const isParentMatch = parent.name.toLowerCase().includes(q);
      const matchingChildren = children.filter((c) => c.name.toLowerCase().includes(q));

      if (isParentMatch) {
        // 1depth가 검색어와 일치: 1depth만 단독 노출 (기획안 확정)
        result.push({
          set: parent,
          depth: 1,
          parentId: null,
          hasChildren: false,
          isCollapsed: false,
        });
      } else if (matchingChildren.length > 0) {
        // 2depth가 검색어와 일치: 1depth 부모 맥락도 함께 노출하고 일치하는 자식들 표시 (기획안 확정)
        result.push({
          set: parent,
          depth: 1,
          parentId: null,
          hasChildren: true,
          isCollapsed: false,
        });
        for (const child of matchingChildren) {
          result.push({
            set: child,
            depth: 2,
            parentId: parent.id,
            hasChildren: false,
            isCollapsed: false,
          });
        }
      }
    }

    return result;
  }, [flatSetList, setSearchQuery, setTree]);

  // 통합 계층 드래그 앤 드롭 핸들러 (1depth <-> 2depth 자유 이동 및 즉시 DB 동기화)
  const handleDropTreeItem = (movedSetId: number, newParentId: number | null, newFlatList: FlatSetItem[]) => {
    // 1. 부모가 변경되었으면 DB sets.parent_id 영구 갱신
    const prevItem = sets.find((s) => s.id === movedSetId);
    if (prevItem && prevItem.parent_id !== newParentId) {
      onUpdateSetParent?.(movedSetId, newParentId);
    }

    // 2. 전체 새로운 순서 계산 (접혀있던 숨김 자식 세트까지 포함하여 정합성 유지)
    const newSets: FontSet[] = [];
    const seenIds = new Set<number>();

    for (const item of newFlatList) {
      newSets.push({
        ...item.set,
        parent_id: item.set.id === movedSetId ? newParentId : item.set.parent_id,
      });
      seenIds.add(item.set.id);
    }

    for (const s of sets) {
      if (!seenIds.has(s.id)) {
        newSets.push(s);
      }
    }

    onReorderSets(newSets);
  };

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
        className={`flex-1 overflow-y-scroll overflow-x-hidden text-xs ${isCollapsed ? "p-1.5 space-y-2" : "pl-3 pr-2 py-3 space-y-4"
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

        {/* Sets & Collections (2depth 폴더화 및 계층 지원) */}
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
              {setTree.map(({ parent, children }) => {
                const isParentActive = activeCategory === `set:${parent.id}`;
                const hasChild = children.length > 0;
                const isCollapsedSet = collapsedSetIds.has(parent.id);

                return (
                  <div key={parent.id} className="space-y-0.5">
                    {/* 1depth 부모 버튼 */}
                    <div className="relative group/parent flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => onSelectSet(parent.id)}
                        title={`${parent.name} (${parent.count})${hasChild ? ` · ${t("sidebar.children_count", { count: children.length, defaultValue: `하위 ${children.length}개` })}` : ""}`}
                        className={`w-9 h-9 mx-auto flex items-center justify-center rounded-lg transition-colors cursor-pointer relative ${
                          isParentActive
                            ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                            : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                        }`}
                      >
                        <span
                          style={{ backgroundColor: parent.color || "#6366f1" }}
                          className="w-3 h-3 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                        />
                        {/* 하위 세트가 있을 때 우측 하단 미니 접기/펼치기 토글 버튼 */}
                        {hasChild && (
                          <span
                            onClick={(e) => toggleCollapseSet(parent.id, e)}
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-theme-surface border border-theme-border flex items-center justify-center text-theme-text-muted hover:text-theme-accent hover:border-theme-accent transition-colors shadow-2xs"
                            title={isCollapsedSet ? t("sidebar.expand", "하위 세트 펼치기") : t("sidebar.collapse", "하위 세트 접기")}
                          >
                            {isCollapsedSet ? (
                              <ChevronRight className="w-2.5 h-2.5" />
                            ) : (
                              <ChevronDown className="w-2.5 h-2.5" />
                            )}
                          </span>
                        )}
                      </button>
                    </div>

                    {/* 2depth 자식 세트 버튼들 (펼쳐져 있을 때 미니 인디케이터와 함께 계층 표시) */}
                    {hasChild && !isCollapsedSet && (
                      <div className="space-y-0.5 py-0.5">
                        {children.map((child) => {
                          const isChildActive = activeCategory === `set:${child.id}`;
                          return (
                            <button
                              key={child.id}
                              type="button"
                              onClick={() => onSelectSet(child.id)}
                              title={`↳ ${parent.name} > ${child.name} (${child.count})`}
                              className={`w-7 h-6 mx-auto flex items-center justify-center gap-0.5 rounded transition-colors cursor-pointer ${
                                isChildActive
                                  ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                                  : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                              }`}
                            >
                              <CornerDownRight className="w-2.5 h-2.5 text-theme-text-muted/60 shrink-0" />
                              <span
                                style={{ backgroundColor: child.color || "#6366f1" }}
                                className="w-2 h-2 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                              />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
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
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSetSearchOpen((prev) => !prev);
                      if (isSetSearchOpen) setSetSearchQuery("");
                    }}
                    className={`hover:text-theme-accent p-0.5 transition-colors cursor-pointer rounded ${
                      isSetSearchOpen || setSearchQuery ? "text-theme-accent" : "text-theme-text-secondary"
                    }`}
                    title={t("sidebar.search_sets", "서재 세트 검색")}
                  >
                    <Search className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalTarget({ mode: "create_set" })}
                    className="hover:text-theme-accent p-0.5 text-theme-text-secondary transition-colors cursor-pointer"
                    title={t("sidebar.create_set")}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 세트 검색창 */}
              {(isSetSearchOpen || setSearchQuery) && (
                <div className="relative mb-2 px-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-theme-text-muted pointer-events-none" />
                  <input
                    type="text"
                    value={setSearchQuery}
                    onChange={(e) => setSetSearchQuery(e.target.value)}
                    placeholder={t("sidebar.search_sets", "서재 세트 검색...")}
                    className="w-full pl-7 pr-6 py-1 text-[11px] bg-theme-hover/70 border border-theme-border rounded-md text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-theme-accent"
                    autoFocus
                  />
                  {setSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setSetSearchQuery("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {sets.length === 0 ? (
                <div
                  onClick={() => setModalTarget({ mode: "create_set" })}
                  className="px-2 py-3 text-center border border-dashed border-theme-border rounded-lg text-theme-text-muted bg-theme-active/20 cursor-pointer hover:border-theme-border-card-hover"
                >
                  <p>{t("sidebar.new_set_empty")}</p>
                </div>
              ) : displayFlatSetList.length === 0 && setSearchQuery ? (
                <div className="px-2 py-3 text-center text-theme-text-muted text-[11px]">
                  <p>{t("sidebar.no_matching_sets", "일치하는 세트가 없습니다.")}</p>
                </div>
              ) : (
                /* 1depth / 2depth 통합 트리 드래그 정렬 (X/Y 좌표 감지 + 명확한 깊이 인디케이터 + 데이터 무손실) */
                <SortableTreeSetList
                  items={displayFlatSetList}
                  onDropItem={handleDropTreeItem}
                  onItemClick={(set) => onSelectSet(set.id)}
                  renderItem={(flatItem, { isDragging, isInsideTarget }) => {
                    const { set: itemSet, depth } = flatItem;
                    const isActive = activeCategory === `set:${itemSet.id}`;

                    if (depth === 1) {
                      return (
                        <div
                          key={itemSet.id}
                          className={`relative group w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left cursor-grab active:cursor-grabbing select-none ${
                            isDragging ? "opacity-30 scale-[0.98] bg-theme-active ring-1 ring-theme-accent" : ""
                          } ${
                            isInsideTarget
                              ? "bg-theme-accent/20 text-theme-accent ring-2 ring-theme-accent shadow-sm"
                              : isActive
                                ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                                : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                          }`}
                        >
                          <span className="flex items-center gap-1.5 truncate pointer-events-none min-w-0">
                            <GripVertical className="w-3 h-3 text-theme-text-muted group-hover:text-theme-accent transition-colors shrink-0" />
                            <span
                              style={{ backgroundColor: itemSet.color || "#6366f1" }}
                              className="w-2 h-2 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                            />
                            <span className="truncate text-[11px] font-medium">{itemSet.name}</span>
                          </span>

                          <div className="flex items-center gap-0.5 shrink-0 ml-1">
                            {/* 하위 세트 바로 추가 버튼 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTarget({
                                  mode: "create_set",
                                  initialParentId: itemSet.id,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-theme-accent transition-opacity cursor-pointer"
                              title={t("sidebar.add_subset", "하위 세트 추가")}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            {/* 수정 버튼 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setModalTarget({
                                  mode: "edit_set",
                                  id: itemSet.id,
                                  name: itemSet.name,
                                  color: itemSet.color || "#6366f1",
                                  parent_id: itemSet.parent_id,
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-theme-accent transition-opacity cursor-pointer"
                              title={t("sidebar.edit_set_title", "서재 세트 수정")}
                            >
                              <Palette className="w-3 h-3" />
                            </button>
                            <span className="text-[11px] font-mono opacity-80 pointer-events-none px-1 min-w-[20px] text-right">
                              {itemSet.count}
                            </span>
                            {/* 삭제 버튼 */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const ch = sets.filter((s) => s.parent_id === itemSet.id);
                                setDeleteTarget({
                                  type: "set",
                                  id: itemSet.id,
                                  name: itemSet.name,
                                  childNames: ch.map((c) => c.name),
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-red-500 transition-opacity cursor-pointer"
                              title={t("sidebar.delete_set")}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // depth === 2 (하위 세트)
                    return (
                      <div
                        key={itemSet.id}
                        className={`relative group flex items-center justify-between ml-3.5 w-[calc(100%-0.875rem)] pl-2 border-l border-theme-border/60 py-1.5 pr-2 rounded-r-lg text-xs font-medium transition-all text-left cursor-grab active:cursor-grabbing select-none ${
                          isDragging ? "opacity-30 scale-[0.98] bg-theme-active ring-1 ring-theme-accent" : ""
                        } ${
                          isActive
                            ? "bg-theme-active text-theme-accent shadow-2xs font-semibold"
                            : "text-theme-text-secondary hover:bg-theme-hover hover:text-theme-text"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate pointer-events-none min-w-0">
                          <GripVertical className="w-3 h-3 text-theme-text-muted/70 group-hover:text-theme-accent transition-colors shrink-0" />
                          <CornerDownRight className="w-2.5 h-2.5 text-theme-text-muted/60 shrink-0" />
                          <span
                            style={{ backgroundColor: itemSet.color || "#6366f1" }}
                            className="w-2 h-2 rounded-full shrink-0 ring-1 ring-theme-surface shadow-2xs"
                          />
                          <span className="truncate text-[11px] font-medium">{itemSet.name}</span>
                        </span>

                        <div className="flex items-center gap-0.5 shrink-0 ml-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalTarget({
                                mode: "edit_set",
                                id: itemSet.id,
                                name: itemSet.name,
                                color: itemSet.color || "#6366f1",
                                parent_id: itemSet.parent_id,
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-theme-accent transition-opacity cursor-pointer"
                            title={t("sidebar.edit_set_title", "서재 세트 수정")}
                          >
                            <Palette className="w-3 h-3" />
                          </button>
                          {onUpdateSetParent && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateSetParent(itemSet.id, null);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-theme-accent transition-opacity cursor-pointer"
                              title={t("sidebar.promote_to_root", "최상위(1depth)로 꺼내기")}
                            >
                              <ArrowUpToLine className="w-3 h-3" />
                            </button>
                          )}
                          <span className="text-[11px] font-mono opacity-80 pointer-events-none px-1 min-w-[20px] text-right">
                            {itemSet.count}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({
                                type: "set",
                                id: itemSet.id,
                                name: itemSet.name,
                              });
                            }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-theme-text-muted hover:text-red-500 transition-opacity cursor-pointer"
                            title={t("sidebar.delete_set")}
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
          initialParentId={
            modalTarget.mode === "create_set"
              ? modalTarget.initialParentId ?? null
              : modalTarget.mode === "edit_set"
                ? modalTarget.parent_id ?? null
                : null
          }
          currentSetId={modalTarget.mode === "edit_set" ? modalTarget.id : undefined}
          availableParents={sets.filter((s) => s.parent_id == null)}
          hasChildren={
            modalTarget.mode === "edit_set" &&
            sets.some((s) => s.parent_id === modalTarget.id)
          }
          onSubmitSet={(name, color, parentId) => {
            if (modalTarget.mode === "create_set") {
              onCreateSet(name, color, parentId);
            } else if (modalTarget.mode === "edit_set") {
              if (onUpdateSet) {
                onUpdateSet(modalTarget.id, name, color, parentId);
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
              : deleteTarget.childNames && deleteTarget.childNames.length > 0
                ? t("sidebar.delete_set_with_children_confirm", {
                    name: deleteTarget.name,
                    count: deleteTarget.childNames.length,
                    children: deleteTarget.childNames.join(", "),
                    defaultValue: `'${deleteTarget.name}' 서재 세트를 삭제하시겠습니까?\n포함된 하위 세트 ${deleteTarget.childNames.length}개(${deleteTarget.childNames.join(", ")})도 함께 삭제됩니다.\n(폰트 원본 파일은 삭제되지 않습니다)`,
                  })
                : t("sidebar.delete_set_confirm", {
                    name: deleteTarget.name,
                    defaultValue: `'${deleteTarget.name}' 서재 세트를 삭제하시겠습니까?\n(폰트 원본 파일은 삭제되지 않습니다)`,
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
