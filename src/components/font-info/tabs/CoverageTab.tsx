import { useTranslation } from "react-i18next";
import { FontDetailedInfo } from "../../../types/font";
import { Check, Layers } from "lucide-react";

interface CoverageTabProps {
  details: FontDetailedInfo;
}

export function CoverageTab({ details }: CoverageTabProps) {
  const { t } = useTranslation();
  const { coverage, opentype_features } = details;

  const getHangulStatusText = () => {
    switch (coverage.hangul_type) {
      case "full_11172":
        return t("font_info.coverage.hangul_status.full_11172");
      case "basic_ks_2350":
        return t("font_info.coverage.hangul_status.basic_ks_2350");
      case "partial":
        return t("font_info.coverage.hangul_status.partial", { count: coverage.hangul_syllable_count });
      default:
        return t("font_info.coverage.hangul_status.none");
    }
  };

  const hangulPercent = Math.min(100, Math.round((coverage.hangul_syllable_count / 11172) * 100));

  return (
    <div className="space-y-4 text-xs text-theme-text">
      {/* 1. 글리프 및 인코딩 문자 통계 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col justify-center">
          <span className="text-[11px] text-theme-text-muted mb-0.5">{t("font_info.coverage.total_glyphs")}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-theme-accent">
              {coverage.total_glyph_count.toLocaleString()}
            </span>
            <span className="text-[10px] text-theme-text-muted">glyphs</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-theme-surface-subtle border border-theme-border-subtle/80 flex flex-col justify-center">
          <span className="text-[11px] text-theme-text-muted mb-0.5">{t("font_info.coverage.encoded_chars")}</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold font-mono text-theme-text">
              {coverage.encoded_char_count.toLocaleString()}
            </span>
            <span className="text-[10px] text-theme-text-muted">chars</span>
          </div>
        </div>
      </div>

      {/* 2. 지원 문자 체계 (동적 뱃지) */}
      <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
        <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
          {t("font_info.coverage.scripts_title")}
        </h4>
        <div className="flex flex-wrap gap-2">
          {coverage.supported_scripts.map((scriptKey) => (
            <span
              key={scriptKey}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-theme-surface border border-theme-border text-xs font-medium text-theme-text shadow-2xs"
            >
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t(`font_info.coverage.scripts.${scriptKey}`, scriptKey)}</span>
            </span>
          ))}
          {coverage.supported_scripts.length === 0 && (
            <span className="text-theme-text-muted text-[11px]">
              {t("font_info.coverage.basic_latin_fallback")}
            </span>
          )}
        </div>

        {/* 언어별 문자 체계 지원율 프로그레스 바 목록 */}
        <div className="mt-3 pt-3 border-t border-theme-border-subtle/60 space-y-3.5">
          {/* 1. 기본 라틴 / 영문 지원율 */}
          {((coverage.latin_basic_count ?? 0) > 0 || coverage.has_latin_basic) && (() => {
            const count = coverage.latin_basic_count ?? 95;
            const percent = Math.min(100, Math.round((count / 95) * 100));
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-theme-text">{t("font_info.coverage.latin_basic_coverage")}</span>
                  <span className="font-mono text-theme-accent">
                    {count.toLocaleString()} / 95{t("font_info.coverage.char_unit")} ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-theme-accent transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[10px] text-theme-text-muted block">
                  {t("font_info.coverage.latin_basic_subtitle")}
                </span>
              </div>
            );
          })()}

          {/* 2. 한글 완성형 지원율 */}
          {coverage.hangul_syllable_count > 0 && (() => {
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-theme-text">{t("font_info.coverage.hangul_coverage")}</span>
                  <span className="font-mono text-theme-accent">
                    {coverage.hangul_syllable_count.toLocaleString()} / 11,172{t("font_info.coverage.char_unit")} ({hangulPercent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-theme-accent transition-all duration-300"
                    style={{ width: `${hangulPercent}%` }}
                  />
                </div>
                <span className="text-[10px] text-theme-text-muted block">
                  {getHangulStatusText()}
                </span>
              </div>
            );
          })()}

          {/* 3. 일본어 가나 지원율 */}
          {((coverage.japanese_kana_count ?? 0) > 0 || coverage.has_japanese_kana) && (() => {
            const count = coverage.japanese_kana_count ?? 192;
            const percent = Math.min(100, Math.round((count / 192) * 100));
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-theme-text">{t("font_info.coverage.japanese_kana_coverage")}</span>
                  <span className="font-mono text-theme-accent">
                    {count.toLocaleString()} / 192{t("font_info.coverage.char_unit")} ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-theme-accent transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[10px] text-theme-text-muted block">
                  {t("font_info.coverage.japanese_kana_subtitle")}
                </span>
              </div>
            );
          })()}

          {/* 4. 라틴 확장 지원율 */}
          {((coverage.latin_extended_count ?? 0) > 0 || coverage.has_latin_extended) && (() => {
            const count = coverage.latin_extended_count ?? 224;
            const percent = Math.min(100, Math.round((count / 224) * 100));
            return (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-medium text-theme-text">{t("font_info.coverage.latin_extended_coverage")}</span>
                  <span className="font-mono text-theme-accent">
                    {count.toLocaleString()} / 224{t("font_info.coverage.char_unit")} ({percent}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-theme-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-theme-accent transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-[10px] text-theme-text-muted block">
                  {t("font_info.coverage.latin_extended_subtitle")}
                </span>
              </div>
            );
          })()}

          {/* 5. CJK 통합 한자 수록 수 표시 */}
          {coverage.cjk_ideograph_count > 0 && (
            <div className="pt-2 border-t border-theme-border-subtle/40 flex items-center justify-between text-[11px]">
              <span className="text-theme-text-muted">{t("font_info.coverage.cjk_coverage")}</span>
              <span className="font-mono font-medium">
                {t("font_info.coverage.characters_included", { count: coverage.cjk_ideograph_count.toLocaleString() })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. 오픈타입 기능 태그 (GSUB/GPOS) */}
      <div className="rounded-xl border border-theme-border-subtle bg-theme-surface-subtle/40 p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-theme-accent" />
          <h4 className="text-[11px] font-semibold text-theme-text uppercase tracking-wider">
            {t("font_info.coverage.opentype_features")}
          </h4>
        </div>

        {opentype_features.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {opentype_features.map((feat) => (
              <span
                key={feat}
                className="px-2 py-0.5 rounded-md bg-theme-surface border border-theme-border-subtle text-[11px] font-mono font-semibold text-theme-text hover:border-theme-accent transition-colors"
                title={`OpenType Feature: ${feat}`}
              >
                {feat}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-theme-text-muted italic pt-1">
            {t("font_info.coverage.no_features")}
          </p>
        )}
      </div>
    </div>
  );
}
