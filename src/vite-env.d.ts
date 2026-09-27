/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_VERSION?: string;
  readonly VITE_DEFAULT_CATEGORY?: string;
  readonly VITE_DEFAULT_PREVIEW_TEXT?: string;
  readonly VITE_DEFAULT_PREVIEW_TEXT_KR?: string;
  readonly VITE_DEFAULT_PREVIEW_TEXT_EN?: string;
  readonly VITE_DEFAULT_PREVIEW_TEXT_NUM?: string;
  readonly VITE_DEFAULT_FONT_SIZE?: string;
  readonly VITE_MIN_FONT_SIZE?: string;
  readonly VITE_MAX_FONT_SIZE?: string;
  readonly VITE_DEFAULT_VIEW_MODE?: string;
  readonly VITE_DEFAULT_GRID_COLUMNS?: string;
  readonly VITE_DEFAULT_VARIABLE_WEIGHT?: string;
  readonly VITE_VIRTUAL_SCROLL_OVERSCAN?: string;
  readonly VITE_MAX_GLYPH_PREVIEW_COUNT?: string;
  readonly VITE_TOAST_DURATION_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
