import { AppTheme } from "../config/appConfig";
import { fontService } from "../services/fontService";
import { createThemeSchema } from "../schemas/settingsSchemas";

export function isLightTheme(theme: AppTheme): boolean {
  return theme === "light" || theme === "clean-white" || theme === "glass";
}

export function getInitialThemeByOS(): AppTheme {
  if (typeof window !== "undefined" && window.matchMedia) {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return isDark ? "nord" : "glass";
  }
  return "glass";
}

export function sanitizeTheme(themeCandidate: unknown, fallback: AppTheme = "glass"): AppTheme {
  return createThemeSchema(fallback).parse(themeCandidate);
}

export function applyTheme(theme: AppTheme): void {
  const validTheme = sanitizeTheme(theme);
  document.documentElement.setAttribute("data-theme", validTheme);
  
  // data-theme-mode: dark 계열과 light 계열 구분
  const isLight = isLightTheme(validTheme);
  if (isLight) {
    document.documentElement.classList.remove("dark");
  } else {
    document.documentElement.classList.add("dark");
  }

  // OS 윈도우 창 프레임 및 타이틀바 테마 동기화
  void fontService.setWindowTheme(isLight ? "light" : "dark");
}
