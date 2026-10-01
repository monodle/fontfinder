import { useTranslation } from "react-i18next";
import { FontDetailedInfo } from "../../../types/font";
import { Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

interface RawMetadataTabProps {
  details: FontDetailedInfo;
}

export function RawMetadataTab({ details }: RawMetadataTabProps) {
  const { t } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const { os2, names } = details;

  return (
    <div className="space-y-4 text-xs text-theme-text">
      {/* 1. OS/2 바이너리 메트릭 원문 테이블 */}
      {os2 && (
        <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
              {t("font_info.raw.os2_table")}
            </h4>
            <span className="text-[10px] text-theme-text-muted font-mono">
              Version: {os2.version}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="border-b border-theme-border-subtle text-theme-text-muted">
                  <th className="py-1.5 px-2 font-medium w-48">{t("font_info.raw.col_metric")}</th>
                  <th className="py-1.5 px-2 font-medium w-28">{t("font_info.raw.col_value")}</th>
                  <th className="py-1.5 px-2 font-medium">{t("font_info.raw.col_desc")}</th>
                  <th className="py-1.5 px-1 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-theme-border-subtle/40 font-mono">
                <tr>
                  <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                    {t("font_info.raw.s_family_class")}
                  </td>
                  <td className="py-1.5 px-2 text-theme-accent">
                    0x{((os2.s_family_class || 0) & 0xffff).toString(16).padStart(4, "0").toUpperCase()}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text-muted font-sans">{os2.family_class_name}</td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopy(`0x${((os2.s_family_class || 0) & 0xffff).toString(16).padStart(4, "0").toUpperCase()}`, "family_class")}
                      className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                      title="복사"
                    >
                      {copiedKey === "family_class" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                    {t("font_info.raw.panose")}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text truncate max-w-[140px]">
                    [{os2.panose.join(" ")}]
                  </td>
                  <td className="py-1.5 px-2 text-theme-text-muted font-sans">
                    Family: {os2.panose[0] ?? "-"}, Serif: {os2.panose[1] ?? "-"}, Weight: {os2.panose[2] ?? "-"}
                  </td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopy(`[${os2.panose.join(" ")}]`, "panose")}
                      className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                      title="복사"
                    >
                      {copiedKey === "panose" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                    {t("font_info.raw.us_weight_class")}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text">{os2.weight_class}</td>
                  <td className="py-1.5 px-2 text-theme-text-muted font-sans">
                    {t("font_info.raw.us_weight_class_desc")}
                  </td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopy(`${os2.weight_class}`, "weight_class")}
                      className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                      {copiedKey === "weight_class" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                    {t("font_info.raw.us_width_class")}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text">{os2.width_class}</td>
                  <td className="py-1.5 px-2 text-theme-text-muted font-sans">
                    {t("font_info.raw.us_width_class_desc")}
                  </td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopy(`${os2.width_class}`, "width_class")}
                      className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                      {copiedKey === "width_class" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                    {t("font_info.raw.fs_selection")}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text">
                    0x{os2.fs_selection.toString(16).padStart(4, "0").toUpperCase()}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text-muted font-sans">
                    {(os2.fs_selection & 0x0020) !== 0 ? "BOLD " : ""}
                    {(os2.fs_selection & 0x0001) !== 0 ? "ITALIC " : ""}
                    {(os2.fs_selection & 0x0040) !== 0 ? "REGULAR " : ""}
                    {(os2.fs_selection & 0x0080) !== 0 ? "USE_TYPO_METRICS " : ""}
                  </td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopy(`0x${os2.fs_selection.toString(16).padStart(4, "0").toUpperCase()}`, "fs_selection")}
                      className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                      {copiedKey === "fs_selection" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>

                <tr>
                  <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                    {t("font_info.raw.fs_type")}
                  </td>
                  <td className="py-1.5 px-2 text-emerald-500">
                    0x{os2.fs_type.toString(16).padStart(4, "0").toUpperCase()}
                  </td>
                  <td className="py-1.5 px-2 text-theme-text-muted font-sans">{os2.fs_type_label}</td>
                  <td className="py-1.5 px-1 text-right">
                    <button
                      type="button"
                      onClick={() => handleCopy(`0x${os2.fs_type.toString(16).padStart(4, "0").toUpperCase()}`, "fs_type")}
                      className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                      {copiedKey === "fs_type" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </td>
                </tr>

                {os2.vendor_id && (
                  <tr>
                    <td className="py-1.5 px-2 text-theme-text font-sans font-medium">
                      {t("font_info.raw.vendor_id")}
                    </td>
                    <td className="py-1.5 px-2 text-theme-text">{os2.vendor_id}</td>
                    <td className="py-1.5 px-2 text-theme-text-muted font-sans">
                      {t("font_info.raw.vendor_id_desc")}
                    </td>
                    <td className="py-1.5 px-1 text-right">
                      <button
                        type="button"
                        onClick={() => handleCopy(os2.vendor_id, "vendor_id")}
                        className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                      >
                        {copiedKey === "vendor_id" ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. Name Table 전체 레코드 테이블 (이중 스크롤 제거하여 상위 모달 스크롤과 일원화) */}
      <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
        <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
          {t("font_info.raw.name_table")}
        </h4>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-theme-border-subtle text-theme-text-muted">
                <th className="py-1.5 px-2 font-medium w-12">{t("font_info.raw.name_id")}</th>
                <th className="py-1.5 px-2 font-medium w-52">{t("font_info.raw.name_key")}</th>
                <th className="py-1.5 px-2 font-medium">{t("font_info.raw.name_value")}</th>
                <th className="py-1.5 px-1 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-theme-border-subtle/40">
              {names.map((record) => {
                const friendlyLabel = t(
                  `font_info.raw.name_labels.${record.name_key}`,
                  record.name_key
                );

                return (
                  <tr key={`${record.name_id}-${record.name_key}`} className="hover:bg-theme-hover/40 transition-colors">
                    <td className="py-2 px-2 font-mono text-theme-text-muted align-top">{record.name_id}</td>
                    <td className="py-2 px-2 align-top">
                      <span className="font-medium text-theme-text block leading-tight">
                        {friendlyLabel}
                      </span>
                      <span className="text-[10px] text-theme-text-muted font-mono block mt-0.5">
                        {record.name_key}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-theme-text break-all select-all font-mono text-[10.5px] leading-relaxed align-top">
                      {record.value}
                    </td>
                    <td className="py-2 px-1 text-right align-top">
                      <button
                        type="button"
                        onClick={() => handleCopy(record.value, `name-${record.name_id}`)}
                        className="p-1 text-theme-text-muted hover:text-theme-text transition-colors"
                        title="복사"
                      >
                        {copiedKey === `name-${record.name_id}` ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
