import React from "react";
import { FontMetadata, FontSet, CustomFolder, CategoryCounts, FontSection } from "./font";

export interface FontCoreDomain {
  fonts: FontMetadata[];
  setFonts: React.Dispatch<React.SetStateAction<FontMetadata[]>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  scanProgress: { current: number; total: number } | null;
  favoriteIds: Set<number>;
  setFavoriteIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  activatedFontIds: Set<number>;
  setActivatedFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
}

export interface FontSetDomain {
  sets: FontSet[]; // enrichedSets
  rawSets: FontSet[];
  setSets: React.Dispatch<React.SetStateAction<FontSet[]>>;
  setMap: Map<number, Set<number>>;
  setFontIds: Set<number>;
  setSetFontIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  refreshSets: () => Promise<FontSet[]>;
  refreshSetCount: (targetSetId?: number) => Promise<void>;
  handleSelectSet: (setId: number) => Promise<void>;
  handleUpdateSet: (setId: number, name: string, color: string, parentId?: number | null) => Promise<boolean>;
  handleUpdateSetParent: (setId: number, parentId: number | null) => Promise<boolean>;
  handleUpdateSetColor: (setId: number, color: string) => Promise<boolean>;
  handleCreateSet: (name: string, color?: string, parentId?: number | null) => Promise<FontSet>;
}

export interface FolderDomain {
  customFolders: CustomFolder[]; // enrichedCustomFolders
  rawFolders: CustomFolder[];
  setCustomFolders: React.Dispatch<React.SetStateAction<CustomFolder[]>>;
  customFoldersRef: React.MutableRefObject<CustomFolder[]>;
  handleRelinkFolder: (oldPath: string, newPath: string, newName?: string) => Promise<boolean>;
  handleRemoveFolderWithData: (path: string) => Promise<boolean>;
  handleUpdateFolderColor: (folderId: number, color: string) => Promise<boolean>;
}

export interface FilterAndSortDomain {
  filteredFonts: FontMetadata[];
  fontSections?: FontSection[];
  categoryCounts: CategoryCounts;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
}

export interface ProcessingDomain {
  unpluggedFonts: FontMetadata[];
  duplicateFontIds: Set<number>;
}

export interface SyncEventsDomain {
  loadSystemFonts: (foldersToScan?: CustomFolder[]) => Promise<FontMetadata[]>;
  loadDbState: () => Promise<void>;
  refreshList: () => Promise<void>;
}

export interface FontLibraryResult {
  core: FontCoreDomain;
  setLibrary: FontSetDomain;
  folderLibrary: FolderDomain;
  filterAndSort: FilterAndSortDomain;
  processing: ProcessingDomain;
  syncEvents: SyncEventsDomain;
}
