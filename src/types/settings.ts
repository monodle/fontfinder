import type { StartupLibraryCategory, AppTheme } from "../config/appConfig";
import type { SupportedLanguageCode } from "../i18n";
import type { ViewMode, FontDetailMode, TextAlignOption } from "./font";
import type { FontSortSettings } from "./sort";

export interface CustomAppSettings {
  defaultCategory: StartupLibraryCategory;
  defaultPreviewText: string;
  defaultFontSize: number;
  minFontSize: number;
  maxFontSize: number;
  defaultViewMode: ViewMode;
  defaultFontDetailMode: FontDetailMode;
  defaultGridColumns: number;
  defaultVariableWeight: number;
  defaultTextColor: string;
  defaultBackgroundColor: string;
  defaultTextAlign: TextAlignOption;
  defaultLineHeight: number;
  defaultLetterSpacing: number;
  defaultIsBold?: boolean;
  defaultIsItalic?: boolean;
  defaultIsUnderline?: boolean;
  fontSortSettings?: FontSortSettings;
  language: SupportedLanguageCode;
  theme: AppTheme;
  enableGoogleFonts?: boolean;
  enableFontsource?: boolean;
}
