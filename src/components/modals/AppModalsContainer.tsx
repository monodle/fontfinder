import type { Dispatch, SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata, PreviewSettings } from "../../types/font";
import { CustomAppSettings } from "../../services/settingsService";
import { ConfirmModal, ToastVariant } from "../common";
import { GlyphDiffModal } from "../diff/GlyphDiffModal";
import { FontInfoModal } from "../font-info/FontInfoModal";
import { PreviewTextModal } from "../preview/PreviewTextModal";
import { SettingsModal, SettingsTab } from "../settings/SettingsModal";
import { OnboardingModal } from "../onboarding/OnboardingModal";

interface AppModalsContainerProps {
  // 모달 상태 및 핸들러 객체
  modals: {
    isSettingsModalOpen: boolean;
    setIsSettingsModalOpen: (open: boolean) => void;
    settingsInitialTab: SettingsTab;
    isPreviewModalOpen: boolean;
    setIsPreviewModalOpen: (open: boolean) => void;
    isOnboardingOpen: boolean;
    isDiffModalOpen: boolean;
    setIsDiffModalOpen: (open: boolean) => void;
    diffModalFonts: FontMetadata[];
    fontInfoState: {
      isOpen: boolean;
      fonts: FontMetadata[];
      initialFont?: FontMetadata | null;
    };
    setFontInfoState: Dispatch<
      SetStateAction<{
        isOpen: boolean;
        fonts: FontMetadata[];
        initialFont?: FontMetadata | null;
      }>
    >;
    uninstallConfirmFonts: FontMetadata[] | null;
    setUninstallConfirmFonts: (fonts: FontMetadata[] | null) => void;
    deactivateConfirmFonts: FontMetadata[] | null;
    setDeactivateConfirmFonts: (fonts: FontMetadata[] | null) => void;
    removeFromSetConfirm: {
      setId: number;
      setName: string;
      fonts: FontMetadata[];
    } | null;
    setRemoveFromSetConfirm: (
      target: {
        setId: number;
        setName: string;
        fonts: FontMetadata[];
      } | null
    ) => void;
  };
  // 프리뷰 및 환경 설정
  previewSettings: PreviewSettings;
  setPreviewSettings: Dispatch<SetStateAction<PreviewSettings>>;
  appSettings: CustomAppSettings;
  handleSaveSettings: (settings: CustomAppSettings) => Promise<void>;
  handleOnboardingComplete: (savedSettings: CustomAppSettings) => void;
  // 액션 핸들러
  actions: {
    handleBulkUninstall: (fonts: FontMetadata[]) => Promise<void>;
    handleRemoveFromSet: (setId: number, fontId: number) => Promise<void>;
    handleBulkRemoveFromSet: (setId: number, fontIds: number[]) => Promise<void>;
    handleToggleActivate: (font: FontMetadata) => Promise<void>;
    handleBulkActivate: (fontIds: number[], activate: boolean) => Promise<void>;
  };
  allFonts: FontMetadata[];
  scanProgress: { current: number; total: number } | null;
  showToast: (msg: string | { message: string; variant?: ToastVariant }) => void;
}

export function AppModalsContainer({
  modals,
  previewSettings,
  setPreviewSettings,
  appSettings,
  handleSaveSettings,
  handleOnboardingComplete,
  actions,
  allFonts,
  scanProgress,
  showToast,
}: AppModalsContainerProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* 1. 시스템 글꼴 영구 제거 확인 모달 */}
      {modals.uninstallConfirmFonts && modals.uninstallConfirmFonts.length > 0 && (
        <ConfirmModal
          isOpen={true}
          onClose={() => modals.setUninstallConfirmFonts(null)}
          onConfirm={async () => {
            const fontsToDelete = [...modals.uninstallConfirmFonts!];
            modals.setUninstallConfirmFonts(null);
            await actions.handleBulkUninstall(fontsToDelete);
          }}
          title={
            modals.uninstallConfirmFonts.length === 1
              ? t("confirm.uninstall_font_title")
              : t("confirm.bulk_uninstall_title")
          }
          itemName={
            modals.uninstallConfirmFonts.length === 1
              ? modals.uninstallConfirmFonts[0].full_name || modals.uninstallConfirmFonts[0].family_name
              : t("confirm.bulk_uninstall_item", {
                  count: modals.uninstallConfirmFonts.length,
                })
          }
          description={
            <div className="space-y-3">
              <p>
                {modals.uninstallConfirmFonts.length === 1
                  ? t("confirm.uninstall_font_desc")
                  : t("confirm.bulk_uninstall_desc", {
                      count: modals.uninstallConfirmFonts.length,
                    })}
              </p>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs leading-relaxed text-left flex items-start gap-2">
                <span className="text-sm shrink-0">🗑️</span>
                <span>{t("confirm.uninstall_warning")}</span>
              </div>
            </div>
          }
          confirmText={t("confirm.uninstall_btn")}
          cancelText={t("common.cancel")}
          isDanger={true}
        />
      )}

      {/* 2. 서재 세트에서 글꼴 제거 확인 모달 */}
      {modals.removeFromSetConfirm && modals.removeFromSetConfirm.fonts.length > 0 && (
        <ConfirmModal
          isOpen={true}
          onClose={() => modals.setRemoveFromSetConfirm(null)}
          onConfirm={async () => {
            const { setId, fonts } = modals.removeFromSetConfirm!;
            modals.setRemoveFromSetConfirm(null);
            if (fonts.length === 1) {
              await actions.handleRemoveFromSet(setId, fonts[0].id);
            } else {
              await actions.handleBulkRemoveFromSet(setId, fonts.map((f) => f.id));
            }
          }}
          title={
            modals.removeFromSetConfirm.fonts.length === 1
              ? t("confirm.remove_from_set_title")
              : t("confirm.bulk_remove_from_set_title")
          }
          itemName={
            modals.removeFromSetConfirm.fonts.length === 1
              ? modals.removeFromSetConfirm.fonts[0].full_name || modals.removeFromSetConfirm.fonts[0].family_name
              : t("confirm.bulk_remove_from_set_item", {
                  count: modals.removeFromSetConfirm.fonts.length,
                })
          }
          description={
            <div className="space-y-1.5 text-center">
              <p>
                {modals.removeFromSetConfirm.fonts.length === 1
                  ? t("confirm.remove_from_set_desc", {
                      setName: modals.removeFromSetConfirm.setName,
                    })
                  : t("confirm.bulk_remove_from_set_desc", {
                      setName: modals.removeFromSetConfirm.setName,
                      count: modals.removeFromSetConfirm.fonts.length,
                    })}
              </p>
              <p className="text-[11px] text-theme-text-muted">
                {t("confirm.remove_from_set_notice")}
              </p>
            </div>
          }
          confirmText={t("confirm.remove_btn")}
          cancelText={t("common.cancel")}
          isDanger={true}
        />
      )}

      {/* 3. 임시 활성화 해제 확인 모달 */}
      {modals.deactivateConfirmFonts && modals.deactivateConfirmFonts.length > 0 && (
        <ConfirmModal
          isOpen={true}
          onClose={() => modals.setDeactivateConfirmFonts(null)}
          onConfirm={async () => {
            const fontsToDeact = [...modals.deactivateConfirmFonts!];
            modals.setDeactivateConfirmFonts(null);
            if (fontsToDeact.length === 1) {
              await actions.handleToggleActivate(fontsToDeact[0]);
            } else {
              await actions.handleBulkActivate(
                fontsToDeact.map((f) => f.id),
                false
              );
            }
          }}
          title={
            modals.deactivateConfirmFonts.length === 1
              ? t("confirm.deactivate_font_title")
              : t("confirm.bulk_deactivate_title")
          }
          itemName={
            modals.deactivateConfirmFonts.length === 1
              ? modals.deactivateConfirmFonts[0].full_name || modals.deactivateConfirmFonts[0].family_name
              : t("confirm.bulk_deactivate_item", {
                  count: modals.deactivateConfirmFonts.length,
                })
          }
          description={
            <div className="space-y-3">
              <p>
                {modals.deactivateConfirmFonts.length === 1
                  ? t("confirm.deactivate_font_desc")
                  : t("confirm.bulk_deactivate_desc", {
                      count: modals.deactivateConfirmFonts.length,
                    })}
              </p>
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-medium text-xs leading-relaxed text-left flex items-start gap-2">
                <span className="text-sm shrink-0">⚠️</span>
                <span>{t("confirm.deactivate_warning")}</span>
              </div>
            </div>
          }
          confirmText={t("confirm.deactivate_btn")}
          cancelText={t("common.cancel")}
          isDanger={true}
        />
      )}

      {/* 4. 글리프 Diff 모달 */}
      <GlyphDiffModal
        isOpen={modals.isDiffModalOpen}
        onClose={() => modals.setIsDiffModalOpen(false)}
        initialFonts={modals.diffModalFonts}
        allFonts={allFonts}
        fallbackText={
          previewSettings.text?.trim() ||
          appSettings.defaultPreviewText?.trim() ||
          "R g h e"
        }
      />

      {/* 5. 폰트 상세 정보 모달 */}
      <FontInfoModal
        isOpen={modals.fontInfoState.isOpen}
        fonts={modals.fontInfoState.fonts}
        initialFont={modals.fontInfoState.initialFont}
        initialPreviewText={
          previewSettings.text?.trim() ||
          appSettings.defaultPreviewText?.trim() ||
          undefined
        }
        onClose={() => modals.setFontInfoState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 6. 프리뷰 텍스트 및 상세 스타일 모달 */}
      <PreviewTextModal
        isOpen={modals.isPreviewModalOpen}
        settings={previewSettings}
        minFontSize={appSettings.minFontSize}
        maxFontSize={appSettings.maxFontSize}
        defaultText={appSettings.defaultPreviewText}
        onClose={() => modals.setIsPreviewModalOpen(false)}
        onApply={(newSettings) => setPreviewSettings(newSettings)}
      />

      {/* 7. 환경설정 모달 */}
      <SettingsModal
        isOpen={modals.isSettingsModalOpen}
        settings={appSettings}
        initialTab={modals.settingsInitialTab}
        onClose={() => modals.setIsSettingsModalOpen(false)}
        onSave={handleSaveSettings}
        onNotify={showToast}
      />

      {/* 8. 온보딩 모달 */}
      <OnboardingModal
        isOpen={modals.isOnboardingOpen}
        initialSettings={appSettings}
        onComplete={handleOnboardingComplete}
        scanProgress={scanProgress}
      />
    </>
  );
}
