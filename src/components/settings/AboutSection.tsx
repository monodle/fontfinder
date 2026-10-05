import { useState } from "react";
import {
  Info,
  Users,
  FileCode2,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Tag,
  Sparkles,
  Lock,
  EyeOff,
  ServerOff,
  CheckCircle2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { appConfig } from "../../config/appConfig";
import {
  CREATORS,
  OPEN_SOURCE_LICENSES,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_SUMMARY,
  OpenSourceLicense,
} from "../../data/aboutData";
import { openExternalUrl } from "../../utils/url";
import appIcon from "@/assets/128x128.png";

type AboutSubSection = "all" | "version" | "creators" | "licenses" | "privacy";

export function AboutSection() {
  const { t } = useTranslation();
  const [activeSubTab, setActiveSubTab] = useState<AboutSubSection>("all");
  const [licenseCategory, setLicenseCategory] = useState<
    "all" | "frontend" | "backend"
  >("all");
  const [isPrivacyExpanded, setIsPrivacyExpanded] = useState(true);

  const filteredLicenses = OPEN_SOURCE_LICENSES.filter((item) => {
    if (licenseCategory === "all") return true;
    return item.category === licenseCategory;
  });

  return (
    <div className="space-y-6">
      {/* 서브 탭 필터 (선택 사항: 전체 또는 특정 섹션만 보기) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-theme-border-subtle no-scrollbar">
        {[
          { id: "all", label: t("about.subtab_all", "전체 정보"), icon: Info },
          { id: "version", label: t("about.subtab_version", "앱 버전"), icon: Tag },
          { id: "creators", label: t("about.subtab_creators", "만든 사람들"), icon: Users },
          { id: "licenses", label: t("about.subtab_licenses", "오픈소스 라이선스"), icon: FileCode2 },
          { id: "privacy", label: t("about.subtab_privacy", "개인정보 처리방침"), icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveSubTab(tab.id as AboutSubSection)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${isActive
                  ? "bg-theme-accent text-theme-accent-text font-semibold shadow-xs"
                  : "text-theme-text-secondary hover:text-theme-text hover:bg-theme-hover"
                }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. 앱 버전 (App Version) */}
      {(activeSubTab === "all" || activeSubTab === "version") && (
        <section className="p-5 rounded-2xl bg-gradient-to-br from-theme-card via-theme-card to-theme-surface border border-theme-border shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-xs flex items-center justify-center shrink-0 border border-theme-border/40">
                <img
                  src={appIcon}
                  alt={appConfig.app.name}
                  className="w-full h-full object-contain select-none"
                  draggable={false}
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-theme-text flex items-center gap-1.5">
                    <span>Font Finder</span>
                    <Sparkles className="w-4 h-4 text-theme-accent" />
                  </h3>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-theme-accent text-theme-accent-text shadow-xs">
                    {appConfig.app.version}
                  </span>
                </div>
                <p className="text-xs text-theme-text-muted mt-0.5">
                  {t("about.app_desc", "현대적이고 직관적인 크로스 플랫폼 데스크톱 폰트 관리자")}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  openExternalUrl(appConfig.links.githubRepo)
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-hover border border-theme-border text-xs font-medium text-theme-text transition-colors cursor-pointer"
              >
                <span>{t("about.github_repo", "GitHub 저장소")}</span>
                <ExternalLink className="w-3 h-3 text-theme-text-muted" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-theme-border-subtle text-[11px]">
            <div className="p-2 rounded-lg bg-theme-surface/50 border border-theme-border/50">
              <span className="text-theme-text-muted block text-[10px]">{t("about.framework", "프레임워크")}</span>
              <span className="font-medium text-theme-text">Tauri v2 + React 19</span>
            </div>
            <div className="p-2 rounded-lg bg-theme-surface/50 border border-theme-border/50">
              <span className="text-theme-text-muted block text-[10px]">{t("about.engine_core", "엔진 코어")}</span>
              <span className="font-medium text-theme-text">Rust 2021 + SQLite</span>
            </div>
            <div className="p-2 rounded-lg bg-theme-surface/50 border border-theme-border/50">
              <span className="text-theme-text-muted block text-[10px]">{t("about.version_sync", "버전 동기화")}</span>
              <span className="font-medium text-theme-accent font-mono">.env</span>
            </div>
            <div className="p-2 rounded-lg bg-theme-surface/50 border border-theme-border/50">
              <span className="text-theme-text-muted block text-[10px]">{t("about.license", "라이선스")}</span>
              <span className="font-medium text-theme-text">MIT License</span>
            </div>
          </div>
        </section>
      )}

      {/* 2. 만든 사람들 (Creators) */}
      {(activeSubTab === "all" || activeSubTab === "creators") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-theme-border-subtle">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-theme-accent" />
              <h3 className="font-semibold text-xs text-theme-text">
                {t("about.creators_title", "만든 사람들")}
              </h3>
            </div>
            <span className="text-[11px] text-theme-text-muted">{t("about.core_contributors", "Core Contributors")}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {CREATORS.map((creator) => (
              <div
                key={creator.id}
                className="p-4 rounded-xl bg-theme-card border border-theme-border flex flex-col justify-between hover:border-theme-border-card-hover transition-all"
              >
                <div>
                  <div className="flex items-start gap-3">
                    <img
                      src={creator.avatarUrl}
                      alt={creator.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                      className="w-11 h-11 rounded-full border border-theme-border object-cover bg-theme-surface shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-theme-text">
                          {creator.name}
                        </span>
                        <span className="text-[10px] text-theme-text-muted">
                          {creator.githubHandle}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-theme-accent">
                        {creator.role}
                      </p>
                    </div>
                  </div>

                  {/* 소개말 영역 */}
                  <div className="mt-3 p-2.5 rounded-lg bg-theme-surface/70 border border-theme-border/60">
                    <span className="text-[10px] font-semibold text-theme-text-muted block mb-1">
                      {t("about.bio_label", "소개말 (Bio)")}
                    </span>
                    <p className="text-xs text-theme-text leading-relaxed">
                      {creator.bio}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-theme-border-subtle flex justify-end">
                  <button
                    type="button"
                    onClick={() => openExternalUrl(creator.githubUrl)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-theme-surface hover:bg-theme-hover border border-theme-border text-xs font-medium text-theme-text transition-colors cursor-pointer"
                  >
                    <span>{t("about.github_profile", "GitHub 프로필")}</span>
                    <ExternalLink className="w-3 h-3 text-theme-text-muted" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 3. 오픈소스 라이선스 (Open Source Licenses) */}
      {(activeSubTab === "all" || activeSubTab === "licenses") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-theme-border-subtle">
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-theme-accent" />
              <h3 className="font-semibold text-xs text-theme-text">
                {t("about.licenses_title", "오픈소스 라이선스")}
              </h3>
            </div>
            <span className="text-[11px] text-theme-text-muted font-mono">
              {t("about.packages_count", "{{count}}개 패키지", { count: filteredLicenses.length })}
            </span>
          </div>

          {/* 카테고리 필터 */}
          <div className="flex items-center gap-1">
            {[
              { id: "all", label: t("about.filter_all", "전체") },
              { id: "frontend", label: t("about.filter_frontend", "프론트엔드") },
              { id: "backend", label: t("about.filter_backend", "백엔드 (Rust)") },
            ].map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  setLicenseCategory(
                    cat.id as "all" | "frontend" | "backend"
                  )
                }
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${licenseCategory === cat.id
                    ? "bg-theme-accent/20 text-theme-accent font-semibold border border-theme-accent/30"
                    : "text-theme-text-muted hover:text-theme-text hover:bg-theme-hover"
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 라이선스 목록 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredLicenses.map((item: OpenSourceLicense) => (
              <div
                key={item.name}
                className="p-3 rounded-xl bg-theme-card border border-theme-border flex flex-col justify-between hover:border-theme-border-card-hover transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold text-xs text-theme-text truncate">
                      {item.name}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-theme-surface border border-theme-border text-theme-accent shrink-0">
                      {item.license}
                    </span>
                  </div>
                  <p className="text-[11px] text-theme-text-muted leading-relaxed line-clamp-2">
                    {t(
                      `about.license_${item.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_desc`,
                      item.description
                    )}
                  </p>
                </div>

                <div className="pt-2 mt-2 border-t border-theme-border-subtle flex justify-end">
                  <button
                    type="button"
                    onClick={() => openExternalUrl(item.url)}
                    className="flex items-center gap-1 text-[11px] text-theme-text-secondary hover:text-theme-accent transition-colors cursor-pointer"
                  >
                    <span>{t("about.repo_and_license", "저장소 / 라이선스")}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. 개인정보 처리방침 (Privacy Policy) */}
      {(activeSubTab === "all" || activeSubTab === "privacy") && (
        <section className="space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-theme-border-subtle">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <h3 className="font-semibold text-xs text-theme-text">
                {t("about.privacy_title", "개인정보 처리방침")}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setIsPrivacyExpanded(!isPrivacyExpanded)}
              className="flex items-center gap-1 text-[11px] text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
            >
              <span>{isPrivacyExpanded ? t("about.collapse", "접기") : t("about.expand", "자세히")}</span>
              {isPrivacyExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* 핵심 요약 배지 카드 */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                <Lock className="w-4 h-4 shrink-0" />
                <span>{t("about.privacy_badge", "100% 로컬 데이터 처리 & 무(無)수집 보장")}</span>
              </div>
              <span className="text-[10px] text-theme-text-muted font-mono">
                {t("about.privacy_network_policy", PRIVACY_POLICY_SUMMARY.networkPolicy)}
              </span>
            </div>
            <p className="text-[11px] text-theme-text-secondary leading-relaxed">
              {t(
                "about.privacy_summary",
                "Font Finder는 사용자의 어떠한 개인정보, 설치된 글꼴 파일, 사용 로그도 수집하지 않으며 외부 서버로 전송하지 않습니다. 모든 작업은 고객님의 로컬 기기 내에서만 독립적으로 이루어집니다."
              )}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-theme-card/60 border border-theme-border/60">
                <ServerOff className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-theme-text">{t("about.no_remote_transmission", "원격 서버 전송 없음")}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-theme-card/60 border border-theme-border/60">
                <EyeOff className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-theme-text">{t("about.no_tracker", "트래커 / 분석기 미탑재")}</span>
              </div>
              <div className="flex items-center gap-1.5 p-2 rounded-lg bg-theme-card/60 border border-theme-border/60">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="text-theme-text">{t("about.local_sqlite_storage", "로컬 SQLite 보관")}</span>
              </div>
            </div>
          </div>

          {/* 상세 조항 아코디언 */}
          {isPrivacyExpanded && (
            <div className="space-y-2.5">
              {PRIVACY_POLICY_SECTIONS.map((section, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-theme-card border border-theme-border space-y-2"
                >
                  <h4 className="font-semibold text-xs text-theme-text">
                    {t(`about.privacy_section_${idx + 1}_title`, section.title)}
                  </h4>
                  <p className="text-[11px] text-theme-text-secondary leading-relaxed">
                    {t(`about.privacy_section_${idx + 1}_desc`, section.description)}
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-[10px] text-theme-text-muted pl-1">
                    {section.points.map((pt, pIdx) => (
                      <li key={pIdx}>
                        {t(`about.privacy_section_${idx + 1}_pt_${pIdx + 1}`, pt)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
