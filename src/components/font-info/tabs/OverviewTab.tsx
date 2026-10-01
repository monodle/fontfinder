import { useTranslation } from "react-i18next";
import { FontDetailedInfo, FontNameRecord } from "../../../types/font";
import { ExternalLink, Copy, Check, ShieldCheck, FileCheck } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { openExternalUrl } from "../../../utils/url";

interface OverviewTabProps {
  details: FontDetailedInfo;
}

export function OverviewTab({ details }: OverviewTabProps) {
  const { t, i18n } = useTranslation();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  // 현재 앱 언어 (ko, en, ja 등)
  const currentLang = useMemo(() => {
    const raw = (i18n.language || "ko").toLowerCase();
    if (raw.startsWith("ko")) return "ko";
    if (raw.startsWith("en")) return "en";
    if (raw.startsWith("ja")) return "ja";
    if (raw.startsWith("zh")) return raw.includes("tw") || raw.includes("hk") ? "zh-TW" : "zh-CN";
    return raw;
  }, [i18n.language]);

  /**
   * 폴백 우선순위 원칙:
   * 1순위: 현재 UI 언어 (targetLang)
   * 2순위: 영어 ('en' / 0x0409)
   * 3순위: 기본 라이선스/메타데이터 정보 (첫 번째 유효 레코드)
   */
  const getBestNameRecord = useCallback(
    (key: string, preferLang?: string): FontNameRecord | undefined => {
      const candidates = details.names.filter((n) => n.name_key === key && n.value.trim().length > 0);
      if (candidates.length === 0) return undefined;

      const langToFind = preferLang || currentLang;

      // 1순위: 지정/현재 언어 매칭
      const matched = candidates.find((n) => n.language_tag === langToFind);
      if (matched) return matched;

      // 2순위: 영어 ('en' / 0x0409)
      const english = candidates.find((n) => n.language_tag === "en" || n.language_id === 0x0409);
      if (english) return english;

      // 3순위: 기본 레코드
      return candidates[0];
    },
    [details.names, currentLang]
  );

  const getNameValue = useCallback(
    (key: string, preferLang?: string): string => {
      const rec = getBestNameRecord(key, preferLang);
      return rec ? rec.value : "";
    },
    [getBestNameRecord]
  );

  // 폰트에 수록된 라이선스 레코드 목록 (다국어 버전 목록)
  const licenseRecords = useMemo(() => {
    return details.names.filter((n) => n.name_key === "license" && n.value.trim().length > 0);
  }, [details.names]);

  // 기본 라이선스 언어 자동 결정: 1) 현재 언어 -> 2) 영어 -> 3) 기본
  const defaultLicenseLang = useMemo(() => {
    if (licenseRecords.length === 0) return "en";
    const hasCurrent = licenseRecords.some((r) => r.language_tag === currentLang);
    if (hasCurrent) return currentLang;
    const hasEn = licenseRecords.some((r) => r.language_tag === "en");
    if (hasEn) return "en";
    return licenseRecords[0].language_tag || "und";
  }, [licenseRecords, currentLang]);

  // 사용자가 수동 선택한 라이선스 언어 상태 (초기값: defaultLicenseLang)
  const [selectedLicenseLang, setSelectedLicenseLang] = useState<string | null>(null);
  const activeLicenseLang = selectedLicenseLang || defaultLicenseLang;

  // 현재 활성화된 라이선스 본문
  const activeLicenseRecord = useMemo(() => {
    return (
      licenseRecords.find((r) => r.language_tag === activeLicenseLang) ||
      getBestNameRecord("license")
    );
  }, [licenseRecords, activeLicenseLang, getBestNameRecord]);

  const designer = getNameValue("designer");
  const manufacturer = getNameValue("manufacturer");
  const copyright = getNameValue("copyright");
  const trademark = getNameValue("trademark");
  const version = getNameValue("version") || "1.000";
  const vendorUrl = getNameValue("vendor_url");
  const designerUrl = getNameValue("designer_url");
  const description = getNameValue("description");
  const licenseDescription = activeLicenseRecord?.value || "";
  const licenseUrl = getNameValue("license_url");

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (ts?: number | null): string => {
    if (!ts || ts <= 0) return "-";
    try {
      const d = new Date(ts * 1000);
      return d.toLocaleDateString();
    } catch {
      return "-";
    }
  };

  const getLanguageLabel = (langTag?: string): string => {
    switch (langTag) {
      case "ko":
        return t("font_info.languages.ko");
      case "en":
        return t("font_info.languages.en");
      case "ja":
        return t("font_info.languages.ja");
      case "zh-CN":
        return t("font_info.languages.zh_cn");
      case "zh-TW":
        return t("font_info.languages.zh_tw");
      case "de":
        return t("font_info.languages.de");
      case "fr":
        return t("font_info.languages.fr");
      case "es":
        return t("font_info.languages.es");
      default:
        return t("font_info.languages.default");
    }
  };

  const styleLabel = useMemo(() => {
    const raw = details.style_classification || "";
    if (raw === "sans_serif") return t("font_info.styles.sans_serif");
    if (raw === "serif") return t("font_info.styles.serif");
    if (raw === "script") return t("font_info.styles.script");
    if (raw === "display") return t("font_info.styles.display");
    if (raw === "monospace") return t("font_info.styles.monospace");
    if (raw === "symbol") return t("font_info.styles.symbol");
    if (raw === "unknown") return t("font_info.styles.unknown");
    return t(`font_info.styles.${raw}`, raw || t("font_info.styles.sans_serif"));
  }, [details.style_classification, t]);

  const embeddingLabel = useMemo(() => {
    const fsType = details.os2?.fs_type;
    if (fsType === undefined || fsType === null || fsType === 0) {
      return t("font_info.fs_type.installable");
    }
    const parts: string[] = [];
    if ((fsType & 0x0002) !== 0) {
      parts.push(t("font_info.fs_type.restricted"));
    }
    if ((fsType & 0x0004) !== 0) {
      parts.push(t("font_info.fs_type.preview_print"));
    }
    if ((fsType & 0x0008) !== 0) {
      parts.push(t("font_info.fs_type.editable"));
    }
    if ((fsType & 0x0100) !== 0) {
      parts.push(t("font_info.fs_type.no_subsetting"));
    }
    if ((fsType & 0x0200) !== 0) {
      parts.push(t("font_info.fs_type.bitmap_only"));
    }
    if (parts.length > 0) {
      return parts.join(", ");
    }
    return details.os2?.fs_type_label || `0x${fsType.toString(16).padStart(4, "0")}`;
  }, [details.os2, t]);

  return (
    <div className="space-y-4 text-xs text-theme-text">
      {/* 1. 스타일 분류 및 임베딩 라이선스 권한 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-theme-text-muted mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-theme-accent" />
            {t("font_info.overview.style_classification")}
          </span>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-theme-accent/15 text-theme-accent border border-theme-accent/20">
              {styleLabel}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col justify-between">
          <span className="text-[11px] font-medium text-theme-text-muted mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            {t("font_info.overview.embedding_license")}
          </span>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
              {embeddingLabel}
            </span>
          </div>
        </div>
      </div>

      {/* 2. 일반 식별 메타데이터 */}
      <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5">
          {designer && (
            <div className="flex flex-col">
              <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.designer")}</span>
              <span className="font-medium mt-0.5 leading-relaxed">{designer}</span>
            </div>
          )}

          {manufacturer && (
            <div className="flex flex-col">
              <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.manufacturer")}</span>
              <span className="font-medium mt-0.5 leading-relaxed">{manufacturer}</span>
            </div>
          )}

          <div className="flex flex-col">
            <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.version")}</span>
            <span className="font-medium font-mono mt-0.5">{version}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.format")}</span>
            <span className="font-medium font-mono mt-0.5">{details.format}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.file_size")}</span>
            <span className="font-medium font-mono mt-0.5">{formatFileSize(details.file_size)}</span>
          </div>

          <div className="flex flex-col">
            <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.created_date")}</span>
            <span className="font-medium font-mono mt-0.5">{formatDate(details.created_timestamp)}</span>
          </div>
        </div>

        {/* 저작권 및 상표 */}
        {copyright && (
          <div className="pt-2 border-t border-theme-border-subtle/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.copyright")}</span>
              <button
                type="button"
                onClick={() => handleCopy(copyright, "copyright")}
                className="text-theme-text-muted hover:text-theme-text p-1 transition-colors"
                title="복사"
              >
                {copiedKey === "copyright" ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="mt-0.5 text-[11px] text-theme-text-muted leading-relaxed select-all">
              {copyright}
            </p>
          </div>
        )}

        {trademark && (
          <div className="pt-2 border-t border-theme-border-subtle/60">
            <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.trademark")}</span>
            <p className="mt-0.5 text-[11px] text-theme-text-muted leading-relaxed select-all">
              {trademark}
            </p>
          </div>
        )}

        {/* 서체 소개 (Description) */}
        {description && (
          <div className="pt-2 border-t border-theme-border-subtle/60">
            <span className="text-[11px] text-theme-text-muted">{t("font_info.overview.description")}</span>
            <p className="mt-0.5 text-[11px] text-theme-text-muted leading-relaxed whitespace-pre-wrap">
              {description}
            </p>
          </div>
        )}

        {/* 제작사 / 디자이너 웹사이트 버튼 */}
        {(vendorUrl || designerUrl) && (
          <div className="pt-2.5 border-t border-theme-border-subtle/60 flex flex-wrap gap-2">
            {vendorUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(vendorUrl)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-hover border border-theme-border-subtle text-xs text-theme-accent transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t("font_info.overview.open_vendor_url")}</span>
              </button>
            )}
            {designerUrl && (
              <button
                type="button"
                onClick={() => openExternalUrl(designerUrl)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-hover border border-theme-border-subtle text-xs text-theme-accent transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>{t("font_info.overview.open_designer_url")}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. 라이선스 상세 조건 섹션 (다국어 폴백: 해당 언어 -> 영어 -> 기본 / 다국어 탭 제공) */}
      {(licenseDescription || licenseUrl) && (
        <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-500" />
              <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
                {t("font_info.overview.license_terms_title")}
              </h4>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {/* 폰트 내에 2개 이상의 언어 라이선스가 있을 때 동적 언어 전환 버튼 */}
              {licenseRecords.length > 1 && (
                <div className="flex items-center rounded-lg bg-theme-surface p-0.5 border border-theme-border-subtle mr-1">
                  {licenseRecords.map((r) => {
                    const tag = r.language_tag || "und";
                    const isSelected = activeLicenseLang === tag;
                    return (
                      <button
                        key={`${r.name_id}-${tag}`}
                        type="button"
                        onClick={() => setSelectedLicenseLang(tag)}
                        className={`px-2 py-0.5 rounded-md text-[10.5px] font-medium transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-theme-accent text-white shadow-2xs"
                            : "text-theme-text-muted hover:text-theme-text"
                        }`}
                      >
                        {getLanguageLabel(tag)}
                      </button>
                    );
                  })}
                </div>
              )}

              {licenseDescription && (
                <button
                  type="button"
                  onClick={() => handleCopy(licenseDescription, "license_desc")}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-theme-hover text-theme-text-muted hover:text-theme-text text-[11px] transition-colors"
                  title={t("font_info.overview.copy_full_text")}
                >
                  {copiedKey === "license_desc" ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>
                    {copiedKey === "license_desc"
                      ? t("font_info.overview.copied")
                      : t("font_info.overview.copy_full_text")}
                  </span>
                </button>
              )}

              {licenseUrl && (
                <button
                  type="button"
                  onClick={() => openExternalUrl(licenseUrl)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-theme-surface hover:bg-theme-hover border border-theme-border-subtle text-theme-accent text-[11px] transition-colors cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>{t("font_info.overview.license_official_page")}</span>
                </button>
              )}
            </div>
          </div>

          {licenseDescription ? (
            <div className="p-3.5 rounded-lg bg-theme-surface border border-theme-border-subtle font-mono text-[11px] text-theme-text-secondary leading-relaxed whitespace-pre-wrap select-all">
              {licenseDescription}
            </div>
          ) : (
            <div className="text-[11px] text-theme-text-muted">
              {t("font_info.overview.check_website_for_license")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
