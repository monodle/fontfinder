import { useTranslation } from "react-i18next";
import { Unplug, Trash2 } from "lucide-react";
import { Badge } from "../common";
import { cn } from "../../utils/cn";
import type { FontInstallStatus, FontVersionStatus } from "../../types/font";

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
          <span title={t("badge.system_tooltip")}>
            {compact
              ? t("badge.system")
              : t("badge.system_full")}
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
          <span title={t("badge.user_tooltip")}>
            {compact
              ? t("badge.user")
              : t("badge.user_full")}
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
          <span title={t("badge.activated_tooltip")}>
            {compact
              ? t("badge.activated")
              : t("badge.activated_full")}
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
              "badge.unplugged_tooltip"
            )}
          >
            {compact
              ? t("badge.unplugged")
              : t("badge.unplugged_full")}
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
              "badge.deleted_tooltip"
            )}
          >
            {compact
              ? t("badge.deleted")
              : t("badge.deleted_full")}
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
          <span title={t("badge.uninstalled_tooltip")}>
            {t("badge.uninstalled")}
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
            "badge.newer_version_tooltip"
          )}
        >
          {compact
            ? t("badge.newer_version")
            : t("badge.newer_version_full")}
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
            "badge.older_version_tooltip"
          )}
        >
          {t("badge.older_version")}
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
        })}
      >
        {compact
          ? `×${count}`
          : t("badge.duplicate", { count })}
      </span>
    </Badge>
  );
}
