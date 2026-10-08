import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FontMetadata, FontSet } from "../types/font";
import { SettingsTab } from "../components/settings/SettingsModal";
import { settingsService } from "../services/settingsService";
import type { ToastVariant } from "../components/common/Toast";

interface UseAppModalsProps {
  selectedFontIds: Set<number>;
  filteredFonts: FontMetadata[];
  sets: FontSet[];
  showToast: (message: string | { message: string; variant?: ToastVariant }) => void;
}

export function useAppModals({
  selectedFontIds,
  filteredFonts,
  sets,
  showToast,
}: UseAppModalsProps) {
  const { t } = useTranslation();

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>("all");
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(() =>
    !settingsService.hasCompletedOnboarding()
  );

  const [isDiffModalOpen, setIsDiffModalOpen] = useState(false);
  const [diffModalFonts, setDiffModalFonts] = useState<FontMetadata[]>([]);

  const [fontInfoState, setFontInfoState] = useState<{
    isOpen: boolean;
    fonts: FontMetadata[];
    initialFont?: FontMetadata | null;
  }>({
    isOpen: false,
    fonts: [],
  });

  const [uninstallConfirmFonts, setUninstallConfirmFonts] = useState<FontMetadata[] | null>(null);
  const [deactivateConfirmFonts, setDeactivateConfirmFonts] = useState<FontMetadata[] | null>(null);
  const [removeFromSetConfirm, setRemoveFromSetConfirm] = useState<{
    setId: number;
    setName: string;
    fonts: FontMetadata[];
  } | null>(null);

  const handleOpenFontInfo = useCallback((fonts: FontMetadata[]) => {
    if (!fonts || fonts.length === 0) return;
    setFontInfoState({
      isOpen: true,
      fonts,
      initialFont: fonts[0],
    });
  }, []);

  const handleOpenDiffModal = useCallback(
    (fontsToDiff?: FontMetadata[]) => {
      let targetFonts = fontsToDiff;

      if (!targetFonts || targetFonts.length === 0) {
        if (selectedFontIds.size > 0) {
          targetFonts = filteredFonts.filter((f) => selectedFontIds.has(f.id));
        } else {
          targetFonts = [];
        }
      }

      if (targetFonts.length > 5) {
        showToast(t("diff.top5_sliced_notice"));
        setDiffModalFonts(targetFonts.slice(0, 5));
      } else {
        setDiffModalFonts(targetFonts);
      }
      setIsDiffModalOpen(true);
    },
    [selectedFontIds, filteredFonts, showToast, t]
  );

  const handleRequestUninstall = useCallback((fontsToUninstall: FontMetadata[]) => {
    const userFonts = fontsToUninstall.filter((f) => f.source === "user");
    if (userFonts.length === 0) return;
    setUninstallConfirmFonts(userFonts);
  }, []);

  const handleRequestDeactivate = useCallback((fontsToDeactivate: FontMetadata[]) => {
    if (fontsToDeactivate.length === 0) return;
    setDeactivateConfirmFonts(fontsToDeactivate);
  }, []);

  const handleRequestRemoveFromSet = useCallback(
    (setId: number, targetFonts: FontMetadata[]) => {
      if (targetFonts.length === 0) return;
      const currentSet = sets.find((s) => s.id === setId);
      setRemoveFromSetConfirm({
        setId,
        setName: currentSet?.name || "",
        fonts: targetFonts,
      });
    },
    [sets]
  );

  const isAnyModalOpen =
    isSettingsModalOpen ||
    isPreviewModalOpen ||
    isOnboardingOpen ||
    isDiffModalOpen ||
    fontInfoState.isOpen;

  return {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    settingsInitialTab,
    setSettingsInitialTab,
    isPreviewModalOpen,
    setIsPreviewModalOpen,
    isOnboardingOpen,
    setIsOnboardingOpen,
    isDiffModalOpen,
    setIsDiffModalOpen,
    diffModalFonts,
    handleOpenDiffModal,
    fontInfoState,
    setFontInfoState,
    handleOpenFontInfo,
    uninstallConfirmFonts,
    setUninstallConfirmFonts,
    handleRequestUninstall,
    deactivateConfirmFonts,
    setDeactivateConfirmFonts,
    handleRequestDeactivate,
    removeFromSetConfirm,
    setRemoveFromSetConfirm,
    handleRequestRemoveFromSet,
    isAnyModalOpen,
  };
}
