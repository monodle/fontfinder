import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FontDetailedInfo, FontMetadata } from "../../types/font";
import { fontService } from "../../services/fontService";
import { loadFontIntoDocument, getCustomFontFamily } from "../../utils/fontLoader";
import { getFontFamilyName } from "../../utils/fontLocalization";
import { OverviewTab } from "./tabs/OverviewTab";
import { MetricsTab } from "./tabs/MetricsTab";
import { CoverageTab } from "./tabs/CoverageTab";
import { RawMetadataTab } from "./tabs/RawMetadataTab";
import {
  FileText,
  Sliders,
  Globe,
  Code2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Folder,
} from "lucide-react";

interface FontInfoViewerProps {
  font: FontMetadata;
  initialPreviewText?: string;
}

type TabType = "overview" | "metrics" | "coverage" | "raw";

const DEFAULT_PREVIEW_TEXT =
  "다람쥐 헌 쳇바퀴에 타고파. The quick brown fox jumps over the lazy dog. 1234567890 !@#$%^&*";

export function FontInfoViewer({ font, initialPreviewText }: FontInfoViewerProps) {
  const { t, i18n } = useTranslation();
  const displayName = getFontFamilyName(font, i18n.language);
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [details, setDetails] = useState<FontDetailedInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 라이브 프리뷰용 상태
  const [previewText, setPreviewText] = useState(
    initialPreviewText?.trim() || DEFAULT_PREVIEW_TEXT
  );
  const [fontSize, setFontSize] = useState(28);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 외부 initialPreviewText 변경 시 동기화
  useEffect(() => {
    if (initialPreviewText?.trim()) {
      setPreviewText(initialPreviewText.trim());
    }
  }, [initialPreviewText]);

  // 1. 해당 폰트 실제 CSS FontFace 로드
  useEffect(() => {
    let isMounted = true;
    setFontLoaded(false);

    loadFontIntoDocument(font)
      .then(() => {
        if (isMounted) setFontLoaded(true);
      })
      .catch(() => {
        if (isMounted) setFontLoaded(false);
      });

    return () => {
      isMounted = false;
    };
  }, [font]);

  // 2. On-Demand 백엔드 상세 파싱
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fontService
      .getFontDetails(font.file_path, font.font_index)
      .then((data) => {
        if (isMounted) {
          setDetails(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(typeof err === "string" ? err : "Failed to load font details");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [font.file_path, font.font_index]);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }, []);

  const customFamily = useMemo(() => {
    return fontLoaded ? `${getCustomFontFamily(font)}, sans-serif` : "sans-serif";
  }, [font, fontLoaded]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-theme-surface">
      {/* 1. 상단 라이브 프리뷰 카드 */}
      <div className="p-4 border-b border-theme-border bg-theme-surface-subtle/30 space-y-3 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-theme-text truncate">
                {displayName}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-theme-hover border border-theme-border-subtle text-theme-text-muted">
                {font.subfamily_name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] font-mono text-theme-text-muted truncate select-all">
                {font.postscript_name}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(font.postscript_name, "ps_name")}
                className="text-theme-text-muted hover:text-theme-text p-0.5 transition-colors"
                title="PostScript Name 복사"
              >
                {copiedKey === "ps_name" ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>

            {/* 파일 경로 최상단 공통 노출 */}
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-theme-text-muted max-w-3xl">
              <Folder className="w-3.5 h-3.5 shrink-0 text-theme-accent" />
              <span className="font-mono truncate select-all text-[11px]" title={font.file_path}>
                {font.file_path}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(font.file_path, "file_path")}
                className="text-theme-text-muted hover:text-theme-text p-0.5 transition-colors shrink-0"
                title="파일 경로 복사"
              >
                {copiedKey === "file_path" ? (
                  <Check className="w-3 h-3 text-emerald-500" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>

          {/* 폰트 크기 슬라이더 */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-theme-text-muted font-mono">{fontSize}px</span>
            <input
              type="range"
              min={14}
              max={72}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-24 accent-theme-accent cursor-pointer"
            />
          </div>
        </div>

        {/* 실제 폰트 렌더링 영역 */}
        <div className="p-3 rounded-xl bg-theme-surface border border-theme-border-subtle min-h-[72px] flex items-center shadow-2xs">
          <p
            className="w-full text-theme-text break-words select-text outline-none leading-normal transition-all"
            style={{
              fontFamily: customFamily,
              fontSize: `${fontSize}px`,
            }}
          >
            {previewText}
          </p>
        </div>

        {/* 문구 인풋 */}
        <input
          type="text"
          value={previewText}
          onChange={(e) => setPreviewText(e.target.value)}
          placeholder={t("font_info.live_preview_placeholder")}
          className="w-full px-3 py-1.5 rounded-lg bg-theme-surface border border-theme-border-subtle text-xs text-theme-text placeholder:text-theme-text-muted focus:outline-none focus:border-theme-accent transition-colors"
        />
      </div>

      {/* 2. 탭 네비게이션 */}
      <div className="px-4 border-b border-theme-border flex items-center gap-1 bg-theme-surface-subtle/50 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "overview"
              ? "border-theme-accent text-theme-accent"
              : "border-transparent text-theme-text-muted hover:text-theme-text"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>{t("font_info.tabs.overview")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("metrics")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "metrics"
              ? "border-theme-accent text-theme-accent"
              : "border-transparent text-theme-text-muted hover:text-theme-text"
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{t("font_info.tabs.metrics")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("coverage")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "coverage"
              ? "border-theme-accent text-theme-accent"
              : "border-transparent text-theme-text-muted hover:text-theme-text"
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>{t("font_info.tabs.coverage")}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("raw")}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer ${
            activeTab === "raw"
              ? "border-theme-accent text-theme-accent"
              : "border-transparent text-theme-text-muted hover:text-theme-text"
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{t("font_info.tabs.raw")}</span>
        </button>
      </div>

      {/* 3. 탭 본문 (스크롤 영역) */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {loading ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-theme-text-muted">
            <Loader2 className="w-6 h-6 animate-spin text-theme-accent" />
            <span className="text-xs">메타데이터 분석 중...</span>
          </div>
        ) : error ? (
          <div className="h-48 flex flex-col items-center justify-center gap-2 text-rose-500">
            <AlertCircle className="w-6 h-6" />
            <span className="text-xs">{error}</span>
          </div>
        ) : details ? (
          <>
            {activeTab === "overview" && <OverviewTab details={details} />}
            {activeTab === "metrics" && <MetricsTab details={details} />}
            {activeTab === "coverage" && <CoverageTab details={details} />}
            {activeTab === "raw" && <RawMetadataTab details={details} />}
          </>
        ) : null}
      </div>

      {/* 4. 하단 면책 및 안내 배너 (Disclaimer) */}
      <div className="p-3 border-t border-theme-border bg-theme-surface-subtle/60 shrink-0">
        <p className="text-[11px] text-theme-text-muted leading-relaxed">
          {t("font_info.disclaimer")}
        </p>
      </div>
    </div>
  );
}
