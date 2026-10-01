import { useState } from "react";
import { Coffee, Heart, ExternalLink, Check, Copy, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CREATORS } from "../../data/aboutData";
import { openExternalUrl } from "../../utils/url";
import { appConfig } from "../../config/appConfig";

export function SponsorSection() {
  const { t } = useTranslation();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isKofiCopied = copiedId === "kofi";

  return (
    <div className="space-y-6">
      {/* 헤더 배너 & 빠른 후원 CTA */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500/10 via-theme-card to-amber-500/5 p-5 border border-amber-500/20">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-inner">
              <Coffee className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-theme-text flex items-center gap-1.5">
                  {t("sponsor.title", "커피 한 잔 보내기")}
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
                  {t("sponsor.badge", "Support & Sponsor")}
                </span>
              </div>
              <p className="text-xs text-theme-text-secondary leading-relaxed">
                {t(
                  "sponsor.desc",
                  "Font Finder는 창작자와 개발자를 위해 정성을 담아 만드는 오픈소스 폰트 매니저입니다. 여러분의 따뜻한 커피 한 잔은 지속적인 업데이트와 새로운 기능 개발에 가장 큰 힘이 됩니다."
                )}
              </p>
            </div>
          </div>

          <div className="w-full sm:w-auto shrink-0 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => openExternalUrl(appConfig.links.sponsorUrl)}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-xs shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 transition-all cursor-pointer active:scale-[0.98]"
            >
              <Coffee className="w-4 h-4" />
              <span>{t("sponsor.go_to_sponsor", "후원하러 가기")}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </button>

            <button
              type="button"
              onClick={() => handleCopy("kofi", appConfig.links.sponsorUrl)}
              className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-hover border border-theme-border text-[11px] font-medium text-theme-text transition-colors cursor-pointer"
              title={t("sponsor.copy_sponsor_link", "후원 링크 복사")}
            >
              {isKofiCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {t("sponsor.copied", "복사됨")}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-theme-text-muted" />
                  <span>{t("sponsor.copy_sponsor_link", "후원 링크 복사")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 후원 방식 카드 그리드 */}
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-theme-text flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500/20" />
          {t("sponsor.makers_title", "개발자에게 직접 응원 보내기")}
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {CREATORS.map((creator) => {
            const isCopied = copiedId === creator.id;
            return (
              <div
                key={creator.id}
                className="group relative p-4 rounded-xl bg-theme-card border border-theme-border hover:border-theme-accent/50 hover:shadow-xs transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-3 mb-2.5">
                    <img
                      src={creator.avatarUrl}
                      alt={creator.name}
                      onError={(e) => {
                        // 이미지 로드 실패 시 대체 그라디언트
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                      className="w-10 h-10 rounded-full border border-theme-border object-cover bg-theme-surface"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-theme-text truncate">
                          {creator.name}
                        </span>
                        <span className="text-[10px] text-theme-text-muted truncate">
                          {creator.githubHandle}
                        </span>
                      </div>
                      <p className="text-[11px] text-theme-accent font-medium truncate">
                        {creator.role}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-theme-text-secondary leading-relaxed mb-3 line-clamp-2">
                    {t(`about.creator_${creator.id.replace(/-/g, "_")}_bio`, creator.bio)}
                  </p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-theme-border-subtle">
                  <button
                    type="button"
                    onClick={() => openExternalUrl(creator.githubUrl)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-hover border border-theme-border text-[11px] font-medium text-theme-text transition-colors cursor-pointer"
                    title={t("sponsor.visit_github", "{{name}} GitHub 프로필 방문", { name: creator.name })}
                  >
                    <span>GitHub</span>
                    <ExternalLink className="w-3 h-3 text-theme-text-muted" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleCopy(creator.id, `${creator.githubUrl}`)
                    }
                    className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors cursor-pointer"
                    title={t("sponsor.copy_link", "링크 복사")}
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px]">{t("sponsor.copied", "복사됨")}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[10px]">{t("sponsor.share", "공유")}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* 감사 메시지 */}
      <div className="text-center py-2">
        <p className="text-[11px] text-theme-text-muted">
          {t("sponsor.thank_you", "💛 보내주신 모든 관심과 응원에 깊이 감사드립니다.")}
        </p>
      </div>
    </div>
  );
}
