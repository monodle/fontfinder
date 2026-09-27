import { Unplug, Trash2 } from "lucide-react";
import { cn } from "../utils/cn";
import type { FontInstallStatus, FontVersionStatus } from "../types/font";

/**
 * 폰트 포맷 약어 변환 헬퍼 (TTC, OTF, TTF, WOFF2, WOFF)
 */
function getShortFormat(format: string): string {
  const f = format.toLowerCase();
  if (f.includes("collection") || f.includes("ttc")) return "TTC";
  if (f.includes("opentype") || f.includes("otf")) return "OTF";
  if (f.includes("truetype") || f.includes("ttf")) return "TTF";
  if (f.includes("woff2")) return "WOFF2";
  if (f.includes("woff")) return "WOFF";
  return format.slice(0, 4);
}

export interface FontFormatBadgeProps {
  format: string;
  compact?: boolean;
  className?: string;
}

export function FontFormatBadge({
  format,
  compact = false,
  className = "",
}: FontFormatBadgeProps) {
  const displayFormat = compact ? getShortFormat(format) : format;

  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded bg-theme-badge text-theme-text-badge font-mono border border-theme-border text-[10px] select-none shrink-0",
        className
      )}
      title={format}
    >
      {displayFormat}
    </span>
  );
}

export interface FontInstallStatusBadgeProps {
  status?: FontInstallStatus;
  compact?: boolean;
  className?: string;
}

export function FontInstallStatusBadge({
  status = "uninstalled",
  compact = false,
  className = "",
}: FontInstallStatusBadgeProps) {
  switch (status) {
    case "installed_system":
      return (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded bg-theme-badge text-theme-text-muted font-medium border border-theme-border text-[9px] select-none shrink-0",
            className
          )}
          title="OS 시스템 보호 폰트"
        >
          {compact ? "시스템" : "시스템 설치"}
        </span>
      );
    case "installed_user":
      return (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium border border-emerald-500/30 text-[9px] select-none shrink-0",
            className
          )}
          title="사용자 OS 설치 폰트"
        >
          {compact ? "설치됨" : "사용자 설치"}
        </span>
      );
    case "activated":
      return (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded bg-theme-accent-subtle text-theme-accent font-medium border border-theme-accent/40 text-[9px] select-none shrink-0",
            className
          )}
          title="현재 세션에 임시 활성화된 폰트"
        >
          {compact ? "활성" : "임시활성화"}
        </span>
      );
    case "unplugged":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-medium border border-amber-500/30 text-[9px] select-none shrink-0",
            className
          )}
          title="원본 파일 연결 끊김 (외장 하드 미연결 또는 파일 부재)"
        >
          <Unplug className="w-2.5 h-2.5" />
          {compact ? "끊김" : "연결 끊김"}
        </span>
      );
    case "deleted":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 font-medium border border-rose-500/30 text-[9px] select-none shrink-0",
            className
          )}
          title="출처 폴더가 앱에서 제거된 폰트 (서재 보존)"
        >
          <Trash2 className="w-2.5 h-2.5" />
          {compact ? "제거됨" : "폴더 제거됨"}
        </span>
      );
    case "uninstalled":
    default:
      return (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 font-medium border border-zinc-500/20 text-[9px] select-none shrink-0",
            className
          )}
          title="디스크/서재 보관 (미설치)"
        >
          미설치
        </span>
      );
  }
}

export interface FontVersionBadgeProps {
  versionStatus?: FontVersionStatus;
  compact?: boolean;
  className?: string;
}

export function FontVersionBadge({
  versionStatus,
  compact = false,
  className = "",
}: FontVersionBadgeProps) {
  if (!versionStatus || versionStatus === "none" || versionStatus === "up_to_date") {
    return null;
  }

  if (versionStatus === "update_available") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30 text-[9px] select-none shrink-0",
          className
        )}
        title="시스템에 설치된 폰트보다 최신 버전입니다"
      >
        {compact ? "신버전" : "업데이트 가능"}
      </span>
    );
  }

  if (versionStatus === "outdated") {
    return (
      <span
        className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 dark:text-rose-400 font-medium border border-rose-500/20 text-[9px] select-none shrink-0",
          className
        )}
        title="시스템에 더 최신 버전이 이미 설치되어 있습니다"
      >
        구버전
      </span>
    );
  }

  return null;
}

