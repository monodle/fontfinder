import { useTranslation } from "react-i18next";
import { Unplug, Trash2 } from "lucide-react";
import { Badge } from "./common";
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
    <Badge
      size="xs"
      variant="default"
      className={cn("font-mono text-[10px] bg-theme-badge text-theme-text-badge shrink-0", className)}
    >
      <span title={format}>{displayFormat}</span>
    </Badge>
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
  const { t } = useTranslation();

  switch (status) {
    case "installed_system":
      return (
        <Badge
          size="xs"
          variant="default"
          className={cn("text-[9px] bg-theme-badge text-theme-text-muted shrink-0", className)}
        >
          <span title={t("badge.system_tooltip", "OS 시스템 보호 폰트")}>
            {compact
              ? t("badge.system", "시스템")
              : t("badge.system_full", "시스템 설치")}
          </span>
        </Badge>
      );
    case "installed_user":
      return (
        <Badge
          size="xs"
          variant="success"
          className={cn("text-[9px] shrink-0", className)}
        >
          <span title={t("badge.user_tooltip", "사용자 OS 설치 폰트")}>
            {compact
              ? t("badge.user", "설치됨")
              : t("badge.user_full", "사용자 설치")}
          </span>
        </Badge>
      );
    case "activated":
      return (
        <Badge
          size="xs"
          variant="accent"
          className={cn("text-[9px] shrink-0", className)}
        >
          <span title={t("badge.activated_tooltip", "현재 세션에 임시 활성화된 폰트")}>
            {compact
              ? t("badge.activated", "활성")
              : t("badge.activated_full", "임시활성화")}
          </span>
        </Badge>
      );
    case "unplugged":
      return (
        <Badge
          size="xs"
          variant="warning"
          icon={<Unplug className="w-2.5 h-2.5" />}
          className={cn("text-[9px] shrink-0", className)}
        >
          <span
            title={t(
              "badge.unplugged_tooltip",
              "원본 파일 연결 끊김 (외장 하드 미연결 또는 파일 부재)"
            )}
          >
            {compact
              ? t("badge.unplugged", "끊김")
              : t("badge.unplugged_full", "연결 끊김")}
          </span>
        </Badge>
      );
    case "deleted":
      return (
        <Badge
          size="xs"
          variant="danger"
          icon={<Trash2 className="w-2.5 h-2.5" />}
          className={cn("text-[9px] shrink-0", className)}
        >
          <span
            title={t(
              "badge.deleted_tooltip",
              "출처 폴더가 앱에서 제거된 폰트 (서재 보존)"
            )}
          >
            {compact
              ? t("badge.deleted", "제거됨")
              : t("badge.deleted_full", "폴더 제거됨")}
          </span>
        </Badge>
      );
    case "uninstalled":
    default:
      return (
        <Badge
          size="xs"
          variant="muted"
          className={cn("text-[9px] shrink-0", className)}
        >
          <span title={t("badge.uninstalled_tooltip", "디스크/서재 보관 (미설치)")}>
            {t("badge.uninstalled", "미설치")}
          </span>
        </Badge>
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
  const { t } = useTranslation();

  if (!versionStatus || versionStatus === "none" || versionStatus === "up_to_date") {
    return null;
  }

  if (versionStatus === "update_available") {
    return (
      <Badge
        size="xs"
        variant="warning"
        className={cn("text-[9px] font-semibold shrink-0", className)}
      >
        <span
          title={t(
            "badge.newer_version_tooltip",
            "시스템에 설치된 폰트보다 최신 버전입니다"
          )}
        >
          {compact
            ? t("badge.newer_version", "신버전")
            : t("badge.newer_version_full", "업데이트 가능")}
        </span>
      </Badge>
    );
  }

  if (versionStatus === "outdated") {
    return (
      <Badge
        size="xs"
        variant="danger"
        className={cn("text-[9px] shrink-0", className)}
      >
        <span
          title={t(
            "badge.older_version_tooltip",
            "시스템에 더 최신 버전이 이미 설치되어 있습니다"
          )}
        >
          {t("badge.older_version", "구버전")}
        </span>
      </Badge>
    );
  }

  return null;
}

export interface FontDuplicateBadgeProps {
  count?: number;
  compact?: boolean;
  className?: string;
}

export function FontDuplicateBadge({
  count = 1,
  compact = false,
  className = "",
}: FontDuplicateBadgeProps) {
  const { t } = useTranslation();

  if (!count || count <= 1) {
    return null;
  }

  return (
    <Badge
      size="xs"
      variant="warning"
      className={cn("text-[9px] font-mono bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 shrink-0", className)}
    >
      <span
        title={t("badge.duplicate_tooltip", {
          count,
          defaultValue: `동일한 폰트 파일이 ${count}개 존재합니다`,
        })}
      >
        {compact
          ? `×${count}`
          : t("badge.duplicate", { count, defaultValue: `중복 ${count}` })}
      </span>
    </Badge>
  );
}
